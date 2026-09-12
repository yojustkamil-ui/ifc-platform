const pool = require('../src/config/database');
const fs = require('fs');
const path = require('path');

const migrate = async () => {
  try {
    console.log('🔄 Starting database migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute migration
    await pool.query(schema);
    
    console.log('✅ Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();
