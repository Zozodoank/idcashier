import mysql from 'mysql2/promise';

async function createDatabase() {
  try {
    // Connect to MySQL server without specifying a database
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
    });

    // Create the database
    await connection.execute('CREATE DATABASE IF NOT EXISTS idcw9344_pos');
    console.log('Database "idcw9344_pos" created successfully!');

    // Close the connection
    await connection.end();
  } catch (error) {
    console.error('Error creating database:', error.message);
  }
}

createDatabase();