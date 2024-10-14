import requests
import re
from PIL import Image, ImageTk
from io import BytesIO

# API endpoint for AniList GraphQL
ANILIST_API_URL = "https://graphql.anilist.co"

# Function to search anime by title for AniList
def search_anime_anilist(title):
    query = '''
    query ($search: String) {
        Media (search: $search, type: ANIME) {
            id
            title {
                romaji
                english
                native
            }
            description
            startDate {
                year
                month
                day
            }
            episodes
            genres
            coverImage {
                large
            }
        }
    }
    '''
    
    variables = {'search': title}
    
    response = requests.post(ANILIST_API_URL, json={'query': query, 'variables': variables})
    
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"AniList query failed with status code {response.status_code}")

# Function to clean and format description text
def format_description(description):
    description = re.sub(r'<br\s*/?>', '\n', description)
    description = re.sub(r'<i>', '', description)
    description = re.sub(r'</i>', '', description)
    description = re.sub(r'<b>', '', description)
    description = re.sub(r'</b>', '', description)
    return description

# Function to load image from URL
def load_image_from_url(url, size=(150, 200)):
    image_data = requests.get(url).content
    image = Image.open(BytesIO(image_data))
    image = image.resize(size, Image.Resampling.LANCZOS)
    return ImageTk.PhotoImage(image)
