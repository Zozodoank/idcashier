// Test the date logic to see if there's an issue
console.log('Testing date comparison logic...');

// Today's date
const today = new Date();
today.setHours(0, 0, 0, 0);
console.log('Today:', today.toISOString().split('T')[0]);

// Example subscription end date (from database)
const subscriptionEndDate = new Date('2026-04-25');
subscriptionEndDate.setHours(0, 0, 0, 0);
console.log('Subscription end date:', subscriptionEndDate.toISOString().split('T')[0]);

// Add one day to make it inclusive
const endDateInclusive = new Date(subscriptionEndDate);
endDateInclusive.setDate(endDateInclusive.getDate() + 1);
console.log('End date inclusive:', endDateInclusive.toISOString().split('T')[0]);

// Check if subscription is expired
const isExpired = today >= endDateInclusive;
console.log('Is subscription expired?', isExpired);

// Another test with an actually expired subscription
const expiredEndDate = new Date('2025-10-28'); // From testing account
expiredEndDate.setHours(0, 0, 0, 0);
console.log('\nExpired subscription end date:', expiredEndDate.toISOString().split('T')[0]);

const expiredEndDateInclusive = new Date(expiredEndDate);
expiredEndDateInclusive.setDate(expiredEndDateInclusive.getDate() + 1);
console.log('Expired end date inclusive:', expiredEndDateInclusive.toISOString().split('T')[0]);

const isExpiredActually = today >= expiredEndDateInclusive;
console.log('Is actually expired subscription expired?', isExpiredActually);