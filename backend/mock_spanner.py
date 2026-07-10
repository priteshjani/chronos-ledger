import sqlite3
import datetime
import uuid
import logging
import re
import dateutil.parser

logger = logging.getLogger(__name__)

# Global in-memory SQLite connection to persist data across client creations
_sqlite_conn = sqlite3.connect(":memory:", check_same_thread=False)

# Define mock param_types
class ParamTypes:
    INT64 = "INT64"
    STRING = "STRING"
    TIMESTAMP = "TIMESTAMP"

param_types = ParamTypes()
COMMIT_TIMESTAMP = "SPANNER_COMMIT_TIMESTAMP"

class Client:
    def __init__(self, project=None, credentials=None, client_info=None, client_options=None):
        self.project = project

    def instance(self, instance_id):
        return Instance(instance_id)

class Instance:
    def __init__(self, instance_id):
        self.instance_id = instance_id

    def list_databases(self):
        # Returns database list with summary name attribute
        return [DatabaseSummary("chronos-ledger-db")]

    def database(self, database_id):
        return Database(database_id)

class DatabaseSummary:
    def __init__(self, name):
        self.name = f"projects/mock-project/instances/mock-instance/databases/{name}"

class Database:
    def __init__(self, database_id):
        self.database_id = database_id
        self._conn = _sqlite_conn

    def create(self):
        # SQLite database is already active in memory
        class Operation:
            def result(self, timeout=None):
                return True
        return Operation()

    def update_ddl(self, ddl_statements):
        cursor = self._conn.cursor()
        for statement in ddl_statements:
            # Clean up Spanner DDL to make it compatible with SQLite
            stmt = statement.strip()
            if not stmt:
                continue
            stmt = stmt.replace("INT64", "INTEGER")
            stmt = stmt.replace("OPTIONS (allow_commit_timestamp=true)", "")
            stmt = stmt.replace("OPTIONS(allow_commit_timestamp=true)", "")
            stmt = stmt.replace("OPTIONS (allow_commit_timestamp = true)", "")
            stmt = re.sub(r"STRING\s*\(\s*\d+\s*\)", "TEXT", stmt)
            stmt = re.sub(r"STRING\s*\(\s*MAX\s*\)", "TEXT", stmt)
            
            # Convert Spanner PRIMARY KEY(...) at the end to SQLite style inline primary key
            pk_match = re.search(r"\)\s*PRIMARY\s+KEY\s*\(([^)]+)\)\s*$", stmt, re.IGNORECASE)
            if pk_match:
                pk_cols = pk_match.group(1)
                stmt_body = stmt[:pk_match.start()].strip()
                stmt = stmt_body + f", PRIMARY KEY({pk_cols}))"
            try:
                cursor.execute(stmt)
            except Exception as e:
                logger.error(f"Mock Spanner DDL execution failed: {stmt}. Error: {e}")
                raise e
        self._conn.commit()
        class Operation:
            def result(self, timeout=None):
                return True
        return Operation()

    def snapshot(self, multi_use=False):
        return Snapshot(self._conn)

    def run_in_transaction(self, func, *args, **kwargs):
        cursor = self._conn.cursor()
        # Enable write transaction
        cursor.execute("BEGIN TRANSACTION")
        transaction = Transaction(self._conn, cursor)
        try:
            res = func(transaction, *args, **kwargs)
            self._conn.commit()
            # Return transaction commit timestamp
            return transaction.commit_timestamp
        except Exception as e:
            self._conn.rollback()
            raise e

    def batch(self):
        return Batch(self._conn)

class Snapshot:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def execute_sql(self, query, params=None, param_types=None):
        return _execute_sql_helper(self.conn, query, params)

class Transaction:
    def __init__(self, conn, cursor):
        self.conn = conn
        self.cursor = cursor
        self.commit_timestamp = datetime.datetime.now(datetime.timezone.utc)

    def execute_sql(self, query, params=None, param_types=None):
        return _execute_sql_helper(self.conn, query, params, self.cursor)

    def execute_update(self, query, params=None, param_types=None):
        if params is None:
            params = {}
        
        # Inject commit timestamp if query needs it
        commit_ts_str = self.commit_timestamp.isoformat()
        query = query.replace("PENDING_COMMIT_TIMESTAMP()", ":_commit_timestamp")
        params["_commit_timestamp"] = commit_ts_str
        
        query = query.replace("@", ":")
        
        cursor = self.cursor or self.conn.cursor()
        cursor.execute(query, params)
        return cursor.rowcount

class Batch:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.conn.commit()
        else:
            self.conn.rollback()

    def delete(self, table, keyset):
        cursor = self.conn.cursor()
        if (getattr(keyset, 'all_ids', False) or 
            getattr(keyset, 'all_elements', False) or 
            getattr(keyset, 'all_', False)):
            cursor.execute(f"DELETE FROM {table}")

    def insert(self, table, columns, values):
        cursor = self.conn.cursor()
        placeholders = ", ".join(["?"] * len(columns))
        query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
        
        processed_values = []
        for row in values:
            processed_row = []
            for val in row:
                if val == COMMIT_TIMESTAMP:
                    processed_row.append(datetime.datetime.now(datetime.timezone.utc).isoformat())
                else:
                    processed_row.append(val)
            processed_values.append(processed_row)
            
        cursor.executemany(query, processed_values)

class KeySet:
    def __init__(self, all_ids=False, all_elements=False, all_=False):
        self.all_ids = all_ids
        self.all_elements = all_elements
        self.all_ = all_ or all_ids or all_elements

def _execute_sql_helper(conn, query, params=None, cursor=None):
    if params is None:
        params = {}
    query = query.replace("@", ":")
    c = cursor or conn.cursor()
    c.execute(query, params)
    
    rows = c.fetchall()
    processed_rows = []
    for row in rows:
        processed_row = []
        for val in row:
            if isinstance(val, str):
                try:
                    # Check if string matches timestamp format to convert back to datetime
                    if len(val) >= 19 and val[4] == '-' and val[7] == '-':
                        dt = dateutil.parser.isoparse(val)
                        processed_row.append(dt)
                        continue
                except Exception:
                    pass
            processed_row.append(val)
        processed_rows.append(processed_row)
    return processed_rows
