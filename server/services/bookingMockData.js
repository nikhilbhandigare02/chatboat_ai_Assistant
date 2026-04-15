/**
 * Mock Data for Appointment Booking System
 * Contains demo users, diagnostic centers, and time slots
 */

export const DEMO_USERS = [
  { id: 1, name: 'Amit', phone: '+919876543210' },
  { id: 2, name: 'Neha', phone: '+919876543211' },
  { id: 3, name: 'Rahul', phone: '+919876543212' },
  { id: 4, name: 'Sneha', phone: '+919876543213' },
  { id: 5, name: 'Vikram', phone: '+919876543214' }
];

export const DIAGNOSTIC_CENTERS = [
  {
    id: 1,
    name: 'HealthCare Diagnostic Center',
    address: '123 Medical Plaza, Downtown', 
    distance:  '5 km',
    isFar: true
  },
  {
    id: 2,
    name: 'City Lab Diagnostics',
    address: '456 Health Street, Midtown',
    distance: '2 km',
    isFar: false
  },
  {
    id: 3,
    name: 'MedPlus Lab',
    address: '789 Wellness Avenue, Uptown',
    distance: '1.5 km',
    isFar: false
  }
];

export const TIME_SLOTS = ['7:00 AM', '8:00 AM', '9:00 AM'];

export const FLOW_TYPES = {
  HOME: 'home',
  CENTER: 'center'
};

export const STEPS = {
  ENTRY: 'entry',
  FLOW_SELECTION: 'flow_selection',
  CENTER_SELECTION: 'center_selection',
  DISTANCE_CONFIRMATION: 'distance_confirmation',
  TIME_SELECTION: 'time_selection',
  VOICE_CONFIRMATION: 'voice_confirmation',
  CONFIRMATION: 'confirmation',
  COMPLETED: 'completed',
  EXISTING_APPOINTMENT_CHECK: 'existing_appointment_check',
  RESCHEDULE_OPTIONS: 'reschedule_options',
  RESCHEDULE_TIME_SELECTION: 'reschedule_time_selection'
};

/**
 * Mock availability checker
 * Rule: Only allow bookings between 7 AM and 9 AM (any time in this range)
 */
export function checkSlotAvailability(time, flowType) {
  // Extract time from the slot string
  const timeMatch = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeMatch) return false;
  
  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  const period = timeMatch[3].toUpperCase();
  
  // Convert to 24-hour format for comparison
  let hour24 = hour;
  if (period === 'PM' && hour !== 12) {
    hour24 = hour + 12;
  } else if (period === 'AM' && hour === 12) {
    hour24 = 0;
  }
  
  // Check if time is between 7:00 AM (7:00) and 9:00 AM (9:00 inclusive)
  // Allow any time from 7:00:00 AM to 9:00:00 AM
  if (hour24 === 7) {
    return minute >= 0 && minute <= 59; // Any minute in 7 AM hour
  } else if (hour24 === 8) {
    return minute >= 0 && minute <= 59; // Any minute in 8 AM hour
  } else if (hour24 === 9) {
    return minute === 0; // Only 9:00 AM exactly
  }
  
  return false;
}

/**
 * Get available slots for a time slot list
 */
export function getAvailableSlots(slots, flowType) {
  return slots.filter(slot => checkSlotAvailability(slot, flowType));
}

/**
 * Get user by ID
 */
export function getUserById(userId) {
  return DEMO_USERS.find(user => user.id === parseInt(userId));
}

/**
 * Get center by ID
 */
export function getCenterById(centerId) {
  return DIAGNOSTIC_CENTERS.find(center => center.id === parseInt(centerId));
}

/**
 * Validate user exists
 */
export function isValidUser(userId) {
  return DEMO_USERS.some(user => user.id === parseInt(userId));
}
