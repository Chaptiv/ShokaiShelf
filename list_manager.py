import tkinter as tk

# In-memory lists to store anime
watch_list = []
buy_list = []

# Add anime to Watch List
def add_to_watch_list(title, update_func):
    if title and title not in watch_list:
        watch_list.append(title)
        update_func()

# Add anime to Buy List
def add_to_buy_list(title, update_func):
    if title and title not in buy_list:
        buy_list.append(title)
        update_func()

# Remove anime from Watch List
def remove_from_watch_list(listbox, update_func):
    selected = listbox.get(tk.ACTIVE)
    if selected in watch_list:
        watch_list.remove(selected)
        update_func()

# Remove anime from Buy List
def remove_from_buy_list(listbox, update_func):
    selected = listbox.get(tk.ACTIVE)
    if selected in buy_list:
        buy_list.remove(selected)
        update_func()

# Update Watch List display
def update_watch_list_display(listbox):
    listbox.delete(0, tk.END)
    for anime in watch_list:
        listbox.insert(tk.END, anime)

# Update Buy List display
def update_buy_list_display(listbox):
    listbox.delete(0, tk.END)
    for anime in buy_list:
        listbox.insert(tk.END, anime)
