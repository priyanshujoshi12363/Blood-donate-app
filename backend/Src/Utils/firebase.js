import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ES6 modules fix)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseDB = null;

try {
  console.log('🔧 Initializing Firebase...');
  
  // Method 1: Check for key.json in current directory
  const keyPath = path.join(process.cwd(), 'key.json');
  
  if (fs.existsSync(keyPath)) {
    console.log('📁 Found key.json at:', keyPath);
    
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://blood-donor-d81f5-default-rtdb.asia-southeast1.firebasedatabase.app/`
    });
    
    firebaseDB = admin.database();
    console.log('✅ Firebase Admin SDK initialized successfully from key.json!');
    console.log('📊 Database URL:', `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`);
    
  } else {
    console.error('❌ key.json not found at:', keyPath);
    console.log('💡 Make sure key.json is in your project root directory');
  }
  
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  console.error('Full error:', error);
  firebaseDB = null;
}

export { admin, firebaseDB };