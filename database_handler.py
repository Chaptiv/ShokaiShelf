import sqlite3
import os

# Function to connect to the SQLite database or create a new one
def connect_to_database(db_path=None):
    if db_path is None:
        db_path = 'anime_database.db'
    conn = sqlite3.connect(db_path)
    return conn

# Function to check if the database file exists
def database_exists(db_path):
    return os.path.exists(db_path)

# Function to create the database schema (Watch List and Buy List tables)
def create_database_schema(conn):
    cursor = conn.cursor()

    # Create Watch List Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS watch_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            cover_url TEXT
        )
    ''')

    # Create Buy List Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS buy_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            cover_url TEXT
        )
    ''')

    conn.commit()

# Function to insert anime into the Watch List
def add_anime_to_watch_list(conn, title, cover_url):
    if not check_anime_exists(conn, title, 'watch_list'):
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO watch_list (title, cover_url) VALUES (?, ?)
        ''', (title, cover_url))
        conn.commit()
    else:
        raise ValueError("Anime already exists in Watch List")

# Function to insert anime into the Buy List
def add_anime_to_buy_list(conn, title, cover_url):
    if not check_anime_exists(conn, title, 'buy_list'):
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO buy_list (title, cover_url) VALUES (?, ?)
        ''', (title, cover_url))
        conn.commit()
    else:
        raise ValueError("Anime already exists in Buy List")

# Function to check if an anime already exists in a list
def check_anime_exists(conn, title, list_name):
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM {list_name} WHERE title = ?", (title,))
    return cursor.fetchone() is not None

# Function to remove an anime from the Watch List or Buy List
def remove_anime_from_list(conn, title, list_name):
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM {list_name} WHERE title = ?", (title,))
    conn.commit()

# Function to fetch all anime from the Watch List
def get_watch_list(conn):
    cursor = conn.cursor()
    cursor.execute('SELECT title, cover_url FROM watch_list')
    return cursor.fetchall()

# Function to fetch all anime from the Buy List
def get_buy_list(conn):
    cursor = conn.cursor()
    cursor.execute('SELECT title, cover_url FROM buy_list')
    return cursor.fetchall()
