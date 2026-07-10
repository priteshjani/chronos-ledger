import sys
import os
sys.path.append(os.path.dirname(__file__))

import json
import uuid
import logging
import random
import datetime
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google.cloud import spanner
from pydantic import BaseModel


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ChronosLedger Virtual Economy Server")

# Enable CORS for frontend UI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load database configuration
config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config.json")
with open(config_path, "r") as f:
    config = json.load(f)

spanner_config = config["databases"]["spanner"]
project_id = config["gcp"]["project_id"]
instance_id = spanner_config["instance_id"]
database_id = spanner_config["database_id_chronos"]

use_mock = os.getenv("USE_MOCK_SPANNER", "false").lower() == "true"

if not use_mock:
    try:
        spanner_client = spanner.Client(project=project_id)
        instance = spanner_client.instance(instance_id)
        # Verify connectivity by listing databases
        _ = list(instance.list_databases())
        database = instance.database(database_id)
        logger.info("Successfully connected to live Cloud Spanner.")
    except Exception as e:
        logger.warning(f"Could not connect to live Cloud Spanner: {e}")
        logger.warning("Spanner credentials missing or connection failed. Falling back to local Mock Spanner Emulator.")
        use_mock = True

if use_mock:
    import sys
    import mock_spanner
    sys.modules["google.cloud.spanner"] = mock_spanner
    spanner = mock_spanner
    spanner_client = mock_spanner.Client(project=project_id)
    instance = spanner_client.instance(instance_id)
    database = instance.database(database_id)
    try:
        from setup_spanner import setup_spanner_ledger
        setup_spanner_ledger()
        logger.info("Local Mock Spanner database pre-seeded successfully.")
    except Exception as preseed_err:
        logger.error(f"Failed to pre-seed local Mock Spanner: {preseed_err}")



class PurchaseRequest(BaseModel):
    player_id: int
    item_id: int

@app.get("/api/state")
def get_state():
    """Returns the current state of players, items, entitlements, and ledger."""
    try:
        players = []
        items = []
        entitlements = []
        ledger = []

        with database.snapshot(multi_use=True) as snapshot:
            # 1. Fetch Players
            results_players = snapshot.execute_sql("SELECT player_id, name, balance FROM players ORDER BY player_id")
            for row in results_players:
                players.append({
                    "player_id": row[0],
                    "name": row[1],
                    "balance": row[2]
                })

            # 2. Fetch Items
            results_items = snapshot.execute_sql("SELECT item_id, name, price, stock FROM items ORDER BY item_id")
            for row in results_items:
                items.append({
                    "item_id": row[0],
                    "name": row[1],
                    "price": row[2],
                    "stock": row[3]
                })

            # 3. Fetch Entitlements
            results_entitlements = snapshot.execute_sql(
                "SELECT entitlement_id, player_id, item_id, granted_at FROM entitlements ORDER BY granted_at DESC"
            )
            for row in results_entitlements:
                entitlements.append({
                    "entitlement_id": row[0],
                    "player_id": row[1],
                    "item_id": row[2],
                    "granted_at": row[3].isoformat() if row[3] else None
                })

            # 4. Fetch Ledger (limited to 50 entries)
            results_ledger = snapshot.execute_sql(
                "SELECT transaction_id, player_id, item_id, amount, timestamp, status FROM ledger ORDER BY timestamp DESC LIMIT 50"
            )
            for row in results_ledger:
                ledger.append({
                    "transaction_id": row[0],
                    "player_id": row[1],
                    "item_id": row[2],
                    "amount": row[3],
                    "timestamp": row[4].isoformat() if row[4] else None,
                    "status": row[5]
                })

        return {
            "players": players,
            "items": items,
            "entitlements": entitlements,
            "ledger": ledger
        }

    except Exception as e:
        logger.error(f"Error fetching state: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/catalog")
def get_catalog():
    """Returns the Knowledge Catalog governance entries and tag templates for Spanner tables."""
    catalog_data = {
        "database": {
            "name": f"projects/{project_id}/instances/{instance_id}/databases/{database_id}",
            "catalog_entry_id": f"entry-spanner-{database_id}",
            "owner": "economy-platform-stewards@company.com",
            "last_synced": datetime.datetime.now(datetime.timezone.utc).isoformat()
        },
        "tables": {
            "players": {
                "display_name": "players",
                "description": "Stores player profiles, gamers metadata and gold coin balances.",
                "spanner_resource": f"//spanner.googleapis.com/projects/{project_id}/instances/{instance_id}/databases/{database_id}/tables/players",
                "schema": [
                    {"column": "player_id", "type": "INT64", "description": "Primary key. Unique player identifier.", "tags": []},
                    {"column": "name", "type": "STRING(100)", "description": "Display name of the gaming profile.", "tags": ["PII_LOW"]},
                    {"column": "balance", "type": "INT64", "description": "Current virtual gold currency wallet balance.", "tags": ["SENSITIVE_FINANCIAL"]}
                ],
                "governance_tags": {
                    "Classification": "Internal / Restricted",
                    "Data Owner": "Virtual Commerce Team",
                    "Retention Period": "10 Years (Audit Required)",
                    "Data Quality Score": "99.9%"
                }
            },
            "items": {
                "display_name": "items",
                "description": "Virtual item inventory with prices and stock levels.",
                "spanner_resource": f"//spanner.googleapis.com/projects/{project_id}/instances/{instance_id}/databases/{database_id}/tables/items",
                "schema": [
                    {"column": "item_id", "type": "INT64", "description": "Primary key. Virtual SKU ID.", "tags": []},
                    {"column": "name", "type": "STRING(100)", "description": "Name of the weapon, elixir or shield in the game store.", "tags": []},
                    {"column": "price", "type": "INT64", "description": "Cost in virtual gold coins.", "tags": []},
                    {"column": "stock", "type": "INT64", "description": "Remaining quantity left in global store inventory.", "tags": []}
                ],
                "governance_tags": {
                    "Classification": "Public",
                    "Data Owner": "Game Design Team",
                    "Retention Period": "Active Lifecycle Only",
                    "Data Quality Score": "100.0%"
                }
            },
            "entitlements": {
                "display_name": "entitlements",
                "description": "Real-time player software entitlements and virtual item ownership licences.",
                "spanner_resource": f"//spanner.googleapis.com/projects/{project_id}/instances/{instance_id}/databases/{database_id}/tables/entitlements",
                "schema": [
                    {"column": "entitlement_id", "type": "STRING(100)", "description": "Primary key. Globally unique license code.", "tags": ["CRYPTOGRAPHIC"]},
                    {"column": "player_id", "type": "INT64", "description": "Foreign key reference to players.player_id.", "tags": []},
                    {"column": "item_id", "type": "INT64", "description": "Foreign key reference to items.item_id.", "tags": []},
                    {"column": "granted_at", "type": "TIMESTAMP", "description": "TrueTime transaction commit timestamp when license was verified.", "tags": ["AUDITABLE"]}
                ],
                "governance_tags": {
                    "Classification": "Highly Confidential (Audit Ledger)",
                    "Data Owner": "Security & Compliance Team",
                    "Retention Period": "Permanent",
                    "Data Quality Score": "100.0% (ACID Verified)"
                }
            },
            "ledger": {
                "display_name": "ledger",
                "description": "ACID transaction log auditing double-spend prevention and checkout payments.",
                "spanner_resource": f"//spanner.googleapis.com/projects/{project_id}/instances/{instance_id}/databases/{database_id}/tables/ledger",
                "schema": [
                    {"column": "transaction_id", "type": "STRING(100)", "description": "Primary key. Unique UUID assigned at payment gateway.", "tags": ["CRYPTOGRAPHIC"]},
                    {"column": "player_id", "type": "INT64", "description": "Buyer account identifier.", "tags": []},
                    {"column": "item_id", "type": "INT64", "description": "Purchased shop SKU.", "tags": []},
                    {"column": "amount", "type": "INT64", "description": "Transaction value in virtual gold coins.", "tags": ["SENSITIVE_FINANCIAL"]},
                    {"column": "timestamp", "type": "TIMESTAMP", "description": "TrueTime serialization point determined by Spanner.", "tags": ["AUDITABLE"]},
                    {"column": "status", "type": "STRING(20)", "description": "Result of checkout transaction: SUCCESS or EXPLOIT_BLOCKED.", "tags": ["AUDIT_COMPLIANCE"]}
                ],
                "governance_tags": {
                    "Classification": "Highly Confidential (Audit Ledger)",
                    "Data Owner": "Commerce Audit & Finance",
                    "Retention Period": "Permanent",
                    "Data Quality Score": "100.0% (Spanner Serializable)"
                }
            }
        }
    }
    return catalog_data

@app.post("/api/reset")
def reset_db():
    """Resets and seeds the Spanner database tables."""
    try:
        from chronos_ledger.backend.setup_spanner import setup_spanner_ledger
        setup_spanner_ledger()
        return {"status": "success", "message": "Database reset successfully."}
    except Exception as e:
        # Fallback to local import if folder structure differs
        try:
            import sys
            import os
            sys.path.append(os.path.dirname(__file__))
            from setup_spanner import setup_spanner_ledger
            setup_spanner_ledger()
            return {"status": "success", "message": "Database reset successfully."}
        except Exception as err:
            logger.error(f"Error resetting database: {err}")
            raise HTTPException(status_code=500, detail=str(err))

def purchase_transaction_logic(transaction, player_id: int, item_id: int, tx_id: str):
    """Core transaction logic executed by Spanner."""
    # 1. Read player balance
    player_query = "SELECT balance, name FROM players WHERE player_id = @player_id"
    results = transaction.execute_sql(
        player_query,
        params={"player_id": player_id},
        param_types={"player_id": spanner.param_types.INT64}
    )
    player_row = list(results)
    if not player_row:
        raise ValueError("Player not found")
    
    current_balance, player_name = player_row[0][0], player_row[0][1]

    # 2. Read item details
    item_query = "SELECT price, stock, name FROM items WHERE item_id = @item_id"
    results = transaction.execute_sql(
        item_query,
        params={"item_id": item_id},
        param_types={"item_id": spanner.param_types.INT64}
    )
    item_row = list(results)
    if not item_row:
        raise ValueError("Item not found")
    
    price, stock, item_name = item_row[0][0], item_row[0][1], item_row[0][2]

    # 3. Check rules
    if stock <= 0:
        raise ValueError(f"Exploit Blocked: '{item_name}' is out of stock.")
    if current_balance < price:
        raise ValueError(f"Exploit Blocked: '{player_name}' has insufficient gold ({current_balance} gold available, {price} needed).")

    # 4. Perform Updates
    new_balance = current_balance - price
    new_stock = stock - 1

    # Update player balance
    transaction.execute_update(
        "UPDATE players SET balance = @balance WHERE player_id = @player_id",
        params={"balance": new_balance, "player_id": player_id},
        param_types={"balance": spanner.param_types.INT64, "player_id": spanner.param_types.INT64}
    )

    # Update item stock
    transaction.execute_update(
        "UPDATE items SET stock = @stock WHERE item_id = @item_id",
        params={"stock": new_stock, "item_id": item_id},
        param_types={"stock": spanner.param_types.INT64, "item_id": spanner.param_types.INT64}
    )

    # Create Entitlement
    entitlement_id = f"ent-{uuid.uuid4().hex[:8]}"
    transaction.execute_update(
        "INSERT INTO entitlements (entitlement_id, player_id, item_id, granted_at) VALUES (@ent_id, @player_id, @item_id, PENDING_COMMIT_TIMESTAMP())",
        params={"ent_id": entitlement_id, "player_id": player_id, "item_id": item_id},
        param_types={"ent_id": spanner.param_types.STRING, "player_id": spanner.param_types.INT64, "item_id": spanner.param_types.INT64}
    )

    # Create Ledger Entry
    transaction.execute_update(
        "INSERT INTO ledger (transaction_id, player_id, item_id, amount, timestamp, status) VALUES (@tx_id, @player_id, @item_id, @amount, PENDING_COMMIT_TIMESTAMP(), @status)",
        params={"tx_id": tx_id, "player_id": player_id, "item_id": item_id, "amount": price, "status": "SUCCESS"},
        param_types={
            "tx_id": spanner.param_types.STRING,
            "player_id": spanner.param_types.INT64,
            "item_id": spanner.param_types.INT64,
            "amount": spanner.param_types.INT64,
            "status": spanner.param_types.STRING
        }
    )
    logger.info(f"Transaction prepared for player {player_id} buying {item_id}.")

def get_truetime_bounds(commit_ts: datetime.datetime):
    # Simulate a realistic TrueTime uncertainty window (2ms to 6ms)
    epsilon_ms = random.uniform(1.0, 3.0)  # Epsilon = 1 to 3 ms
    epsilon = datetime.timedelta(milliseconds=epsilon_ms)
    earliest = commit_ts - epsilon
    latest = commit_ts + epsilon
    return {
        "commit_timestamp": commit_ts.isoformat(),
        "earliest": earliest.isoformat(),
        "latest": latest.isoformat(),
        "uncertainty_ms": round(epsilon_ms * 2, 2)
    }

@app.post("/api/purchase")
def purchase_item(req: PurchaseRequest):
    """Executes purchase with Strict ACID transaction in Spanner."""
    tx_id = f"tx-{uuid.uuid4().hex[:8]}"
    try:
        # Spanner SDK handles transaction retries automatically
        commit_ts = database.run_in_transaction(
            purchase_transaction_logic,
            player_id=req.player_id,
            item_id=req.item_id,
            tx_id=tx_id
        )
        truetime_data = get_truetime_bounds(commit_ts) if commit_ts else None
        return {
            "status": "success",
            "message": f"Successfully purchased item {req.item_id}!",
            "transaction_id": tx_id,
            "truetime": truetime_data
        }
    except ValueError as val_err:
        # Write a failed transaction record to the ledger
        logger.warning(f"Purchase validation failed: {val_err}")
        commit_ts = None
        try:
            # We insert the failed transaction to show player attempt audit log
            def log_failure(transaction):
                transaction.execute_update(
                    "INSERT INTO ledger (transaction_id, player_id, item_id, amount, timestamp, status) VALUES (@tx_id, @player_id, @item_id, @amount, PENDING_COMMIT_TIMESTAMP(), @status)",
                    params={"tx_id": tx_id, "player_id": req.player_id, "item_id": req.item_id, "amount": 0, "status": "EXPLOIT_BLOCKED"},
                    param_types={
                        "tx_id": spanner.param_types.STRING,
                        "player_id": spanner.param_types.INT64,
                        "item_id": spanner.param_types.INT64,
                        "amount": spanner.param_types.INT64,
                        "status": spanner.param_types.STRING
                    }
                )
            commit_ts = database.run_in_transaction(log_failure)
        except Exception as log_err:
            logger.error(f"Could not log transaction failure to ledger: {log_err}")
            
        truetime_data = get_truetime_bounds(commit_ts) if commit_ts else None
        return JSONResponse(
            status_code=400,
            content={
                "status": "exploit_blocked",
                "detail": str(val_err),
                "transaction_id": tx_id,
                "truetime": truetime_data
            }
        )
    except Exception as e:
        logger.error(f"Transaction aborted or failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transaction Failed: {str(e)}")


# Mount static files for React frontend if built directory exists
static_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(static_dir):
    logger.info(f"Mounting static files from {static_dir}")
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
