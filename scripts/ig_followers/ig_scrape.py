from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time
import json
import os
import random

# Function to introduce random delays
def random_delay(min_seconds=2, max_seconds=5):
    time.sleep(random.uniform(min_seconds, max_seconds))

# Path to your Chrome user data
chrome_user_data = "/Users/ivanwinters/Library/Application Support/Google/Chrome/Default"  # Update this path
chrome_profile = "Default"  # Change if using a different profile

# Path to your external JavaScript file
js_file_path = "ig_followers.js"  # Ensure this path is correct

# Configure Chrome options to use the existing profile
chrome_options = Options()
chrome_options.add_argument(f"user-data-dir={chrome_user_data}")
chrome_options.add_argument(f"profile-directory={chrome_profile}")
chrome_options.add_argument("--start-maximized")
# Uncomment the following line to run Chrome in headless mode
# chrome_options.add_argument("--headless")

# Initialize WebDriver with the configured options
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

def navigate_to_profile(profile_url):
    driver.get(profile_url)
    random_delay(5, 7)  # Wait for the profile page to load

def execute_external_js(js_path):
    with open(js_path, 'r', encoding='utf-8') as file:
        js_code = file.read()
    driver.execute_script(js_code)
    random_delay(10, 15)  # Wait for the script to execute

def get_console_logs():
    logs = driver.get_log("browser")
    followers = []
    followings = []
    dontFollowMeBack = []
    iDontFollowBack = []
    for entry in logs:
        message = entry["message"]
        # Attempt to parse JSON objects from console messages
        if '"username"' in message:
            try:
                json_start = message.index('{')
                json_str = message[json_start:]
                data = json.loads(json_str)
                if 'followers' in data:
                    followers = data['followers']
                elif 'followings' in data:
                    followings = data['followings']
                elif 'dontFollowMeBack' in data:
                    dontFollowMeBack = data['dontFollowMeBack']
                elif 'iDontFollowBack' in data:
                    iDontFollowBack = data['iDontFollowBack']
            except:
                pass
        elif '"err"' in message:
            try:
                json_start = message.index('{')
                json_str = message[json_start:]
                data = json.loads(json_str)
                print("Error:", data)
            except:
                pass
    return followers, followings, dontFollowMeBack, iDontFollowBack

# Define your Instagram profile URL
profile_url = "https://www.instagram.com/ivan.winters/" 

# Navigate to your Instagram profile
navigate_to_profile(profile_url)

# Execute the external JavaScript to fetch followers and followings
execute_external_js(js_file_path)

# Retrieve and process console logs
followers, followings, dontFollowMeBack, iDontFollowBack = get_console_logs()

# Print the results
print("Followers:", json.dumps(followers, indent=2))
print("Followings:", json.dumps(followings, indent=2))
print("Don't Follow Me Back:", json.dumps(dontFollowMeBack, indent=2))
print("I Don't Follow Back:", json.dumps(iDontFollowBack, indent=2))

# Optionally, save the results to JSON files
with open('followers.json', 'w', encoding='utf-8') as f:
    json.dump(followers, f, indent=2)

with open('followings.json', 'w', encoding='utf-8') as f:
    json.dump(followings, f, indent=2)  

with open('dontFollowMeBack.json', 'w', encoding='utf-8') as f:
    json.dump(dontFollowMeBack, f, indent=2)

with open('iDontFollowBack.json', 'w', encoding='utf-8') as f:
    json.dump(iDontFollowBack, f, indent=2)

# Close the browser
driver.quit()
