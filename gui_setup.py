import tkinter as tk
from api_handler import load_image_from_url, search_anime_anilist
from database_handler import get_watch_list, get_buy_list, add_anime_to_watch_list, add_anime_to_buy_list, remove_anime_from_list
import re

# Function to format the description by removing HTML tags and adding line breaks
def format_description(description):
    description = re.sub(r'<br\s*/?>', '\n', description)  # Replace <br> with newlines
    description = re.sub(r'<i>', '', description)  # Remove <i> tags
    description = re.sub(r'</i>', '', description)
    description = re.sub(r'<b>', '', description)  # Remove <b> tags
    description = re.sub(r'</b>', '', description)
    return description

# Function to handle hover effects on anime titles
def on_enter(event, label):
    label.config(fg="blue", font=("Helvetica", 10, "underline"))

def on_leave(event, label):
    label.config(fg="black", font=("Helvetica", 10))

# Function to display the homepage with search and last 3 listings
def display_homepage(main_frame, conn):
    # Clear previous content
    for widget in main_frame.winfo_children():
        widget.destroy()

    # Search Section
    search_frame = tk.Frame(main_frame)
    search_frame.pack(pady=20)

    search_label = tk.Label(search_frame, text="Search Anime:", font=("Helvetica", 12))
    search_label.grid(row=0, column=0, padx=5)

    search_entry = tk.Entry(search_frame, width=40, font=("Helvetica", 12))
    search_entry.grid(row=0, column=1, padx=5)

    search_button = tk.Button(search_frame, text="Search", command=lambda: handle_search(search_entry, main_frame, conn))
    search_button.grid(row=0, column=2, padx=5)

    # Watch List Section (Left Side)
    watch_list_frame = tk.Frame(main_frame)
    watch_list_frame.pack(side=tk.LEFT, padx=20, pady=20)

    watch_list = get_watch_list(conn)
    if watch_list:
        watch_list_label = tk.Label(watch_list_frame, text="Watch List (Last 3)", font=("Helvetica", 14))
        watch_list_label.pack(pady=10)

        for anime in watch_list[-3:]:
            cover_url = anime[1]
            cover_image = load_image_from_url(cover_url, size=(80, 100))
            cover_label = tk.Label(watch_list_frame, image=cover_image)
            cover_label.image = cover_image
            cover_label.pack(pady=5)

            title_label = tk.Label(watch_list_frame, text=anime[0], font=("Helvetica", 10))
            title_label.pack(pady=5)

            # Add double-click event and hover effect to the anime title
            title_label.bind("<Double-1>", lambda event, anime_title=anime[0]: search_anime(anime_title, main_frame, conn))
            title_label.bind("<Enter>", lambda event, lbl=title_label: on_enter(event, lbl))
            title_label.bind("<Leave>", lambda event, lbl=title_label: on_leave(event, lbl))

    # Button to open full Watch List
    full_watch_button = tk.Button(watch_list_frame, text="View Full Watch List", command=lambda: view_full_list('watch_list', main_frame, conn))
    full_watch_button.pack(pady=10)

    # Buy List Section (Right Side)
    buy_list_frame = tk.Frame(main_frame)
    buy_list_frame.pack(side=tk.RIGHT, padx=20, pady=20)

    buy_list = get_buy_list(conn)
    if buy_list:
        buy_list_label = tk.Label(buy_list_frame, text="Buy List (Last 3)", font=("Helvetica", 14))
        buy_list_label.pack(pady=10)

        for anime in buy_list[-3:]:
            cover_url = anime[1]
            cover_image = load_image_from_url(cover_url, size=(80, 100))
            cover_label = tk.Label(buy_list_frame, image=cover_image)
            cover_label.image = cover_image
            cover_label.pack(pady=5)

            title_label = tk.Label(buy_list_frame, text=anime[0], font=("Helvetica", 10))
            title_label.pack(pady=5)

            # Add double-click event and hover effect to the anime title
            title_label.bind("<Double-1>", lambda event, anime_title=anime[0]: search_anime(anime_title, main_frame, conn))
            title_label.bind("<Enter>", lambda event, lbl=title_label: on_enter(event, lbl))
            title_label.bind("<Leave>", lambda event, lbl=title_label: on_leave(event, lbl))

    # Button to open full Buy List
    full_buy_button = tk.Button(buy_list_frame, text="View Full Buy List", command=lambda: view_full_list('buy_list', main_frame, conn))
    full_buy_button.pack(pady=10)

# Function to handle searching for anime
def handle_search(search_entry, main_frame, conn):
    anime_title = search_entry.get()
    if not anime_title.strip():
        tk.messagebox.showerror("Error", "Please enter an anime title to search")
    else:
        # Search for the anime and display results
        search_anime(anime_title, main_frame, conn)

# Function to search for anime and display results
def search_anime(title, main_frame, conn):
    try:
        # Perform the search query using the AniList API
        anime_data = search_anime_anilist(title)
        media = anime_data['data']['Media']

        # Extract relevant information
        anime_title = media['title']['romaji']
        description = format_description(media['description'])  # Format the description
        cover_url = media['coverImage']['large']

        # Clear the previous content (homepage)
        for widget in main_frame.winfo_children():
            widget.destroy()

        # Display the search results
        result_frame = tk.Frame(main_frame)
        result_frame.pack(pady=20)

        cover_image = load_image_from_url(cover_url, size=(150, 200))
        cover_label = tk.Label(result_frame, image=cover_image)
        cover_label.image = cover_image
        cover_label.grid(row=0, column=0, padx=10)

        result_label = tk.Label(result_frame, text=f"Title: {anime_title}\nDescription: {description}", font=("Helvetica", 10), wraplength=400, justify="left")
        result_label.grid(row=0, column=1, padx=10)

        # Add buttons to add the anime to the Watch List or Buy List
        button_frame = tk.Frame(main_frame)
        button_frame.pack(pady=20)

        watch_button = tk.Button(button_frame, text="Add to Watch List", command=lambda: add_anime_to_watch_list(conn, anime_title, cover_url))
        watch_button.pack(side=tk.LEFT, padx=10)

        buy_button = tk.Button(button_frame, text="Add to Buy List", command=lambda: add_anime_to_buy_list(conn, anime_title, cover_url))
        buy_button.pack(side=tk.LEFT, padx=10)

        # Add button to go back to homepage
        back_button = tk.Button(button_frame, text="Back to Homepage", command=lambda: display_homepage(main_frame, conn))
        back_button.pack(side=tk.LEFT, padx=10)

    except Exception as e:
        tk.messagebox.showerror("Error", str(e))

# Function to display the full list (Watch List or Buy List)
def view_full_list(list_type, main_frame, conn):
    # Clear previous content
    for widget in main_frame.winfo_children():
        widget.destroy()

    list_frame = tk.Frame(main_frame)
    list_frame.pack(pady=20)

    if list_type == 'watch_list':
        anime_list = get_watch_list(conn)
        title = "Full Watch List"
    else:
        anime_list = get_buy_list(conn)
        title = "Full Buy List"

    list_label = tk.Label(list_frame, text=title, font=("Helvetica", 14))
    list_label.pack(pady=10)

    for anime in anime_list:
        cover_url = anime[1]
        cover_image = load_image_from_url(cover_url, size=(80, 100))
        cover_label = tk.Label(list_frame, image=cover_image)
        cover_label.image = cover_image
        cover_label.pack(pady=5)

        title_label = tk.Label(list_frame, text=anime[0], font=("Helvetica", 10))
        title_label.pack(pady=5)

        # Add double-click event and hover effect to the anime title
        title_label.bind("<Double-1>", lambda event, anime_title=anime[0]: search_anime(anime_title, main_frame, conn))
        title_label.bind("<Enter>", lambda event, lbl=title_label: on_enter(event, lbl))
        title_label.bind("<Leave>", lambda event, lbl=title_label: on_leave(event, lbl))

    # Add a back button to return to the homepage
    back_button = tk.Button(list_frame, text="Back to Homepage", command=lambda: display_homepage(main_frame, conn))
    back_button.pack(pady=20)
