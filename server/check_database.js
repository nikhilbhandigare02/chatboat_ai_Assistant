import sqliteService from './services/sqliteService.js';

async function checkDatabase() {
  try {
    console.log('Checking database content...');
    
    // Get all appointments for user 1
    const result = await sqliteService.getUserAppointments('1');
    console.log('Found appointments:', result.appointments.length);
    
    if (result.appointments.length > 0) {
      console.log('Appointments:');
      result.appointments.forEach((apt, index) => {
        console.log(`${index + 1}. ID: ${apt.id}, Type: ${apt.appointment_type}, Time: ${apt.appointment_time}, Status: ${apt.status}`);
      });
    }
    
    // Also check with specific status
    const confirmedResult = await sqliteService.getUserAppointments('1', 'confirmed');
    console.log('\nConfirmed appointments:', confirmedResult.appointments.length);
    
    const rescheduledResult = await sqliteService.getUserAppointments('1', 'rescheduled');
    console.log('Rescheduled appointments:', rescheduledResult.appointments.length);
    
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

checkDatabase().catch(console.error);
