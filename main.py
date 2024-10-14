import tkinter as tk
from tkinter import messagebox, filedialog
import os
from ttkbootstrap import Style
from gui_setup import display_homepage  # Importing only display_homepage for the homepage
from api_handler import search_anime_anilist, format_description, load_image_from_url
from database_handler import connect_to_database, create_database_schema

# Function to auto-detect or prompt for database
def setup_database():
    # Check if the default database file already exists
    db_filename = "anime_database.db"
    if os.path.exists(db_filename):
        try:
            conn = connect_to_database(db_filename)
            create_database_schema(conn)  # Ensure schema exists
            return conn
        except Exception as e:
            messagebox.showerror("Database Error", f"Failed to connect to the database: {str(e)}")
            return None
    else:
        # Ask the user if they want to create a new one or use an existing one
        use_existing_db = messagebox.askyesno("Database Setup", "No database found. Do you want to use an existing database?")
        
        if use_existing_db:
            # Ask for file path to existing database
            db_path = filedialog.askopenfilename(filetypes=[("SQLite Database", "*.db")])
            if db_path:
                try:
                    conn = connect_to_database(db_path)
                    create_database_schema(conn)  # Ensure schema exists
                    return conn
                except Exception as e:
                    messagebox.showerror("Database Error", f"Failed to connect to the database: {str(e)}")
                    return None
            else:
                messagebox.showwarning("File Selection Error", "No file selected. Please try again.")
                return None
        else:
            # Automatically create a new database
            try:
                conn = connect_to_database(db_filename)  # Create new database
                create_database_schema(conn)
                return conn
            except Exception as e:
                messagebox.showerror("Database Error", f"Failed to create a new database: {str(e)}")
                return None

# Function to handle searching for anime
def handle_search(search_entry, cover_label, result_label, current_anime, watch_button, buy_button, conn):
    anime_title = search_entry.get()
    if not anime_title.strip():
        messagebox.showwarning("Input Error", "Please enter an anime title.")
        return

    try:
        anime_data = search_anime_anilist(anime_title)
        media = anime_data['data']['Media']
        title = media['title']['romaji']
        description = format_description(media['description'])
        cover_url = media['coverImage']['large']

        # Update current anime data
        current_anime['title'] = title
        current_anime['cover'] = cover_url

        # Set the text information
        result_label.config(text=f"Title: {title}\nDescription: {description}")
        
        # Load and display the image
        img = load_image_from_url(cover_url)
        cover_label.config(image=img)
        cover_label.image = img  # Keep a reference to avoid garbage collection

        # Enable the buttons once a valid search result is returned
        watch_button.config(state=tk.NORMAL)
        buy_button.config(state=tk.NORMAL)
        
    except Exception as e:
        messagebox.showerror("Error", str(e))

# Function to initialize the program
def initialize_program():
    # Initialize root window
    style = Style(theme="darkly")
    root = style.master
    root.title("Anime Manager")
    
    current_anime = {}

    # Set up the database
    conn = setup_database()
    if conn is None:
        messagebox.showerror("Database Error", "Unable to proceed without a valid database connection.")
        root.destroy()
        return

    # Create the main frame for the application
    main_frame = tk.Frame(root)
    main_frame.pack(fill="both", expand=True)

    # Display the homepage (where users can search for anime and see their lists)
    display_homepage(main_frame, conn)

    # Start the Tkinter main loop
    root.geometry("800x600")
    root.mainloop()

# Entry point for the program
if __name__ == "__main__":
    initialize_program()
