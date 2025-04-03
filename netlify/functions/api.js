const { exec } = require('child_process');
const serverless = require('serverless-http');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();

// Install Python dependencies on cold starts
exports.handler = async function(event, context) {
  // Pass request to serverless handler
  return new Promise((resolve, reject) => {
    // Forward all requests to Flask app through spawn
    const method = event.httpMethod || 'GET';
    const path = event.path.replace('/.netlify/functions/api', '') || '/';
    const queryString = event.queryStringParameters 
      ? Object.entries(event.queryStringParameters).map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    const fullPath = queryString ? `${path}?${queryString}` : path;
    
    const body = event.body || '';
    
    // Construct command to call Flask app
    const command = `python -c "import sys; sys.path.insert(0, '.'); import app; from flask import request; print(app.flask_app_handle_request('${method}', '${fullPath}', '''${body}'''));"`;
    
    exec(command, {
      cwd: process.cwd(),
      env: { ...process.env }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        return resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Internal Server Error', details: stderr })
        });
      }
      
      try {
        // Attempt to parse the response from Flask
        const response = JSON.parse(stdout.trim());
        resolve({
          statusCode: response.status_code || 200,
          headers: response.headers || { 'Content-Type': 'application/json' },
          body: response.body || ''
        });
      } catch (e) {
        console.error(`Error parsing response: ${e.message}`);
        console.error(`Stdout: ${stdout}`);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Error processing response' })
        });
      }
    });
  });
};
