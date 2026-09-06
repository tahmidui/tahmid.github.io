#!/usr/bin/env python3
"""CGI script adapted from Examples/basiccgi/sayhello.py

Handles GET and POST; reads query string or POST body and displays
submitted `name`, `email`, and `message` fields in HTML.
"""
import os
import sys
import urllib.parse
import html

# Determine request method
request_method = os.environ.get('REQUEST_METHOD', 'GET').upper()

if request_method == 'POST':
    content_length = int(os.environ.get('CONTENT_LENGTH', 0) or 0)
    post_data = sys.stdin.read(content_length)
    qs_values = urllib.parse.parse_qs(post_data, keep_blank_values=True)
else:
    query_string = os.environ.get('QUERY_STRING', '')
    qs_values = urllib.parse.parse_qs(query_string, keep_blank_values=True)

def get_first(key):
    vals = qs_values.get(key, [''])
    return vals[0]

name = html.escape(get_first('name'))
email = html.escape(get_first('email'))
message = html.escape(get_first('message')).replace('\n', '<br />')

print('Content-Type: text/html')
print()
print('<!DOCTYPE html>')
print('<html>')
print('<head><meta charset="utf-8"><title>Contact Response</title></head>')
print('<body>')
print('<h1>Contact Form Submission</h1>')
print('<p>Data received from the form:</p>')
print('<ul>')
print(f'<li><strong>Name:</strong> {name}</li>')
print(f'<li><strong>Email:</strong> {email}</li>')
print(f'<li><strong>Message:</strong> {message}</li>')
print('</ul>')
print('<p><a href="/">Return to site</a></p>')
print('</body>')
print('</html>')
