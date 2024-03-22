from selenium import webdriver

hub_url = 'http://selenium_hub:4444'
app_base_url = 'https://app.beddybytes.local'

chrome_options = webdriver.ChromeOptions()
# allow self-signed certificates
chrome_options.add_argument("--ignore-certificate-errors")
# Recommended by https://webrtc.org/getting-started/testing
chrome_options.add_argument("--allow-file-access-from-files")
chrome_options.add_argument("--disable-translate")
chrome_options.add_argument("--use-fake-ui-for-media-stream")
chrome_options.add_argument("--use-fake-device-for-media-stream")
chrome_options.add_argument("--mute-audio")
# --use-file-for-fake-audio-capture=<filename> - Provide a file to use when capturing audio.
# --use-file-for-fake-video-capture=<filename> - Provide a file to use when capturing video.