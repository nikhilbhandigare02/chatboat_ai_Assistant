import sqliteService from './services/sqliteService.js';

async function clearDatabase() {
  try {
    console.log('Clearing database...');
    
    // This is a bit of a hack, but we'll delete the database file directly
    import('fs').then(fs => {
      const fsModule = fs.default || fs;
      import('path').then(path => {
        const pathModule = path.default || path;
        const dbPath = pathModule.join(process.cwd(), 'server', 'data', 'appointments.db');
        
        try {
          fsModule.unlinkSync(dbPath);
          console.log('Database file deleted successfully');
        } catch (error) {
          console.log('Database file does not exist or could not be deleted:', error.message);
        }
      });
    });
    
  } catch (error) {
    console.error('Error clearing database:', error);
  }
}

clearDatabase().catch(console.error);
