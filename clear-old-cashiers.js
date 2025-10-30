// Script to clear old localStorage cashier data
// This script should be run in the browser console or as part of the frontend deployment

(function() {
  console.log('Clearing old localStorage cashier data...');
  
  // Count items before clearing
  const beforeCount = localStorage.length;
  console.log(`Items in localStorage before clearing: ${beforeCount}`);
  
  // Remove old cashier data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('cashier')) {
      keysToRemove.push(key);
    }
  }
  
  // Remove idcashier_cashiers specifically
  keysToRemove.push('idcashier_cashiers');
  
  // Remove the identified keys
  let removedCount = 0;
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      console.log(`Removed: ${key}`);
      removedCount++;
    }
  });
  
  // Count items after clearing
  const afterCount = localStorage.length;
  console.log(`Items in localStorage after clearing: ${afterCount}`);
  console.log(`Removed ${removedCount} cashier-related items`);
  console.log('Old cashier data cleared successfully!');
  
  // Optional: Show remaining keys
  console.log('\nRemaining localStorage keys:');
  for (let i = 0; i < localStorage.length; i++) {
    console.log(`- ${localStorage.key(i)}`);
  }
})();