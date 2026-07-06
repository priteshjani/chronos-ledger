import json
import logging
from google.cloud import spanner

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_spanner_ledger():
    import os
    import sys
    global spanner
    
    # 1. Load config
    with open("config.json", "r") as f:
        config = json.load(f)
        
    spanner_config = config["databases"]["spanner"]
    instance_id = spanner_config["instance_id"]
    database_id = spanner_config["database_id_chronos"]
    project_id = config["gcp"]["project_id"]
    
    use_mock = os.getenv("USE_MOCK_SPANNER", "false").lower() == "true"
    
    if not use_mock:
        try:
            logger.info(f"Connecting to Spanner Instance: {instance_id} under Project: {project_id}")
            spanner_client = spanner.Client(project=project_id)
            instance = spanner_client.instance(instance_id)
            # Try to list databases to check connection
            _ = list(instance.list_databases())
        except Exception as e:
            logger.warning(f"Could not connect to live Google Cloud Spanner: {e}")
            logger.warning("Falling back to local Mock Spanner Emulator for setup.")
            use_mock = True
            
    if use_mock:
        import mock_spanner
        sys.modules["google.cloud.spanner"] = mock_spanner
        spanner = mock_spanner
        spanner_client = mock_spanner.Client(project=project_id)
        instance = spanner_client.instance(instance_id)
    
    # 2. Check and Create Database
    db_list = [db.name.split("/")[-1] for db in instance.list_databases()]
    
    ddl_statements = [
        """
        CREATE TABLE players (
            player_id INT64 NOT NULL,
            name STRING(100) NOT NULL,
            balance INT64 NOT NULL
        ) PRIMARY KEY(player_id)
        """,
        """
        CREATE TABLE items (
            item_id INT64 NOT NULL,
            name STRING(100) NOT NULL,
            price INT64 NOT NULL,
            stock INT64 NOT NULL
        ) PRIMARY KEY(item_id)
        """,
        """
        CREATE TABLE entitlements (
            entitlement_id STRING(100) NOT NULL,
            player_id INT64 NOT NULL,
            item_id INT64 NOT NULL,
            granted_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true)
        ) PRIMARY KEY(entitlement_id)
        """,
        """
        CREATE TABLE ledger (
            transaction_id STRING(100) NOT NULL,
            player_id INT64 NOT NULL,
            item_id INT64 NOT NULL,
            amount INT64 NOT NULL,
            timestamp TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),
            status STRING(20) NOT NULL
        ) PRIMARY KEY(transaction_id)
        """
    ]
    
    database = instance.database(database_id)
    if database_id not in db_list:
        logger.info(f"Database {database_id} does not exist. Creating empty database...")
        operation = database.create()
        operation.result(120)
        logger.info("Empty database created. Deploying DDL statements...")
        operation_ddl = database.update_ddl(ddl_statements)
        operation_ddl.result(120)
        logger.info("Database schema deployed successfully.")
    else:
        logger.info(f"Database {database_id} already exists. Verifying / recreating schema...")
        # For demo purposes, we will clear existing tables and seed clean datasets.
        try:
            with database.batch() as batch:
                batch.delete("ledger", spanner.KeySet(all_ids=True))
                batch.delete("entitlements", spanner.KeySet(all_ids=True))
                batch.delete("items", spanner.KeySet(all_ids=True))
                batch.delete("players", spanner.KeySet(all_ids=True))
            logger.info("Cleared existing records from tables.")
        except Exception as e:
            logger.warning(f"Could not clear tables (they might be empty or missing): {e}")
            
    # 3. Seed initial records
    logger.info("Seeding player profiles...")
    with database.batch() as batch:
        # Players
        batch.insert(
            table="players",
            columns=["player_id", "name", "balance"],
            values=[
                (1, "Alice (Pro Gamer)", 1500),
                (2, "Bob (Exploit Tester)", 450),  # Enough for 1 Dragon Sword, NOT 2!
                (3, "Charlie (Casual Player)", 120)
            ]
        )
        
        # Items
        batch.insert(
            table="items",
            columns=["item_id", "name", "price", "stock"],
            values=[
                (101, "Dragon Slayer Sword", 400, 10),
                (102, "Healing Elixir", 50, 100),
                (103, "Legendary Shield of Valoria", 800, 5)
            ]
        )
        
        # Initial Entitlement
        batch.insert(
            table="entitlements",
            columns=["entitlement_id", "player_id", "item_id", "granted_at"],
            values=[
                ("init-ent-1", 1, 102, spanner.COMMIT_TIMESTAMP)
            ]
        )
        
        # Initial Ledger entry
        batch.insert(
            table="ledger",
            columns=["transaction_id", "player_id", "item_id", "amount", "timestamp", "status"],
            values=[
                ("init-tx-1", 1, 102, 50, spanner.COMMIT_TIMESTAMP, "SUCCESS")
            ]
        )
        
    logger.info("ChronosLedger Spanner database seeding completed successfully!")

if __name__ == "__main__":
    setup_spanner_ledger()
