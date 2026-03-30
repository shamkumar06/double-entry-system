import sqlite3
import os

db_path = os.path.join("d:\\Double entry system\\backend", "finance.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def add_column(table, column, col_type):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type};")
        print(f"Added {column} to {table}.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"Column {column} already exists in {table}.")
        else:
            print(f"Error adding {column} to {table}: {e}")

add_column("projects", "description", "TEXT DEFAULT ''")
add_column("projects", "logo_url", "TEXT DEFAULT ''")

add_column("phases", "description", "TEXT DEFAULT ''")
add_column("phases", "received_amount", "FLOAT DEFAULT 0.0")
add_column("phases", "is_received", "BOOLEAN DEFAULT 0")
add_column("phases", "received_from", "TEXT DEFAULT ''")
add_column("phases", "received_to", "TEXT DEFAULT ''")
add_column("phases", "payment_mode", "TEXT DEFAULT ''")
add_column("phases", "reference", "TEXT DEFAULT ''")

conn.commit()
conn.close()
print("Migration script completed.")
