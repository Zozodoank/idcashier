// Debug script untuk masalah token expiry dan email verification
// Menjalankan test untuk mengidentifikasi masalah

const fs = require('fs');
const path = require('path');

console.log('🔍 MEMULAI DIAGNOSIS TOKEN EXPIRY...\n');

// Test 1: Periksa konfigurasi JWT dan OTP
console.log('1️⃣ PERIKSA KONFIGURASI JWT/OTP:');
try {
    const configPath = 'supabase/config.toml';
    if (fs.existsSync(configPath)) {
        const config = fs.readFileSync(configPath, 'utf8');
        
        // Extract JWT expiry
        const jwtMatch = config.match(/jwt_expiry\s*=\s*(\d+)/);
        const jwtExpiry = jwtMatch ? jwtMatch[1] : 'Not found';
        console.log(`   JWT Expiry: ${jwtExpiry} seconds (${Math.round(jwtExpiry/3600)} jam)`);
        
        // Extract OTP expiry
        const otpMatch = config.match(/otp_expiry\s*=\s*(\d+)/);
        const otpExpiry = otpMatch ? otpMatch[1] : 'Not found';
        console.log(`   OTP Expiry: ${otpExpiry} seconds (${Math.round(otpExpiry/3600)} jam)`);
        
        // Extract rate limits
        const emailSent = config.match(/email_sent\s*=\s*(\d+)/);
        const signInUp = config.match(/sign_in_sign_ups\s*=\s*(\d+)/);
        const tokenVerif = config.match(/token_verifications\s*=\s*(\d+)/);
        
        console.log(`   Rate Limits:`);
        console.log(`   - Email sent per hour: ${emailSent ? emailSent[1] : 'Not found'}`);
        console.log(`   - Sign up/in per 5min: ${signInUp ? signInUp[1] : 'Not found'}`);
        console.log(`   - Token verifications per 5min: ${tokenVerif ? tokenVerif[1] : 'Not found'}`);
        
        // Check site URL
        const siteUrl = config.match(/site_url\s*=\s*"([^"]+)"/);
        console.log(`   Site URL: ${siteUrl ? siteUrl[1] : 'Not found'}`);
        
    } else {
        console.log('   ❌ File config.toml tidak ditemukan');
    }
} catch (error) {
    console.log(`   ❌ Error membaca config: ${error.message}`);
}

console.log('\n2️⃣ PERIKSA ENVIRONMENT VARIABLES:');
try {
    if (fs.existsSync('.env.duitku')) {
        const env = fs.readFileSync('.env.duitku', 'utf8');
        const lines = env.split('\n');
        
        let foundSupabaseUrl = false;
        let foundSiteUrl = false;
        
        for (const line of lines) {
            if (line.includes('SUPABASE_URL') && !line.startsWith('#')) {
                console.log(`   ✅ SUPABASE_URL found in .env.duitku`);
                foundSupabaseUrl = true;
            }
            if (line.includes('SITE_URL') && !line.startsWith('#')) {
                console.log(`   ✅ SITE_URL found in .env.duitku`);
                foundSiteUrl = true;
            }
        }
        
        if (!foundSupabaseUrl) {
            console.log(`   ❌ SUPABASE_URL not found in .env.duitku`);
        }
        if (!foundSiteUrl) {
            console.log(`   ❌ SITE_URL not found in .env.duitku`);
        }
    } else {
        console.log('   ❌ File .env.duitku tidak ditemukan');
    }
} catch (error) {
    console.log(`   ❌ Error membaca .env.duitku: ${error.message}`);
}

console.log('\n3️⃣ PERIKSA AUTH-CONTEXT AUTO REFRESH:');
try {
    const authContextPath = 'src/contexts/AuthContext.jsx';
    if (fs.existsSync(authContextPath)) {
        const authContext = fs.readFileSync(authContextPath, 'utf8');
        
        // Check untuk auto-refresh logic
        if (authContext.includes('checkTokenExpiry') || authContext.includes('refreshSession')) {
            console.log('   ✅ Auto-refresh logic ditemukan di AuthContext');
            
            // Check refresh interval
            const intervalMatch = authContext.match(/setInterval\([^,]+,\s*(\d+)\s*\*\s*\d+\s*\*\s*\d+\)/);
            if (intervalMatch) {
                const intervalSeconds = intervalMatch[1];
                console.log(`   ⏱️  Auto-refresh interval: ${intervalSeconds} seconds`);
            }
            
            // Check expiry check threshold
            if (authContext.includes('5 * 60 * 1000') || authContext.includes('5*60*1000')) {
                console.log('   ✅ Token expiry check threshold: 5 menit sebelum expire');
            }
        } else {
            console.log('   ❌ Auto-refresh logic TIDAK ditemukan di AuthContext');
        }
    } else {
        console.log('   ❌ File AuthContext.jsx tidak ditemukan');
    }
} catch (error) {
    console.log(`   ❌ Error membaca AuthContext: ${error.message}`);
}

console.log('\n4️⃣ PERIKSA BACKEND AUTH-REGISTER LOGIC:');
try {
    const authRegisterPath = 'supabase/functions/auth-register/index.ts';
    if (fs.existsSync(authRegisterPath)) {
        const authRegister = fs.readFileSync(authRegisterPath, 'utf8');
        
        // Check untuk site URL usage
        if (authRegister.includes('SITE_URL') || authRegister.includes('siteUrl')) {
            console.log('   ✅ Site URL dynamic usage ditemukan');
        } else {
            console.log('   ❌ Site URL HARDCODE atau tidak ditemukan');
        }
        
        // Check untuk email resend logic
        if (authRegister.includes('resend') && authRegister.includes('emailRedirectTo')) {
            console.log('   ✅ Email resend dengan dynamic redirect ditemukan');
        } else {
            console.log('   ❌ Email resend logic tidak ditemukan atau hardcode');
        }
        
        // Check untuk user recovery logic
        if (authRegister.includes('already registered')) {
            console.log('   ✅ User recovery logic untuk existing users ditemukan');
        }
    } else {
        console.log('   ❌ File auth-register/index.ts tidak ditemukan');
    }
} catch (error) {
    console.log(`   ❌ Error membaca auth-register: ${error.message}`);
}

console.log('\n5️⃣ PERIKSA PEMBAHASAN POTENTIAL ISSUES:');
console.log('   🔍 Kemungkinan masalah yang perlu diperbaiki:');
console.log('   - Timezone mismatch antara server dan client');
console.log('   - Token parsing yang salah saat decoding');
console.log('   - Race condition antara frontend auto-refresh dan session');
console.log('   - Hardcoded redirect URLs yang tidak sesuai environment');

console.log('\n✅ DIAGNOSIS SELESAI!\n');
console.log('💡 REKOMENDASI:');
console.log('1. Pastikan environment variables SITE_URL dan SUPABASE_URL tersetting');
console.log('2. Test dengan user yang berbeda timezone');
console.log('3. Periksa browser developer tools untuk token expiry times');
console.log('4. Validasi bahwa auto-refresh berfungsi dengan benar');

// Generate test user untuk debugging
const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpass123',
    name: 'Test User',
    role: 'owner'
};

console.log('\n📝 TEST USER UNTUK DEBUG:');
console.log(JSON.stringify(testUser, null, 2));

console.log('\n🚀 NEXT STEPS:');
console.log('1. Jalankan script test email verification');
console.log('2. Monitor token expiry di browser dev tools');
console.log('3. Perbaiki timezone dan parsing issues yang ditemukan');