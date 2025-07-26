const { execSync } = require('child_process');

console.log('🔍 Getting production MongoDB URI from Vercel...\n');

try {
  // Get environment variables from Vercel
  const result = execSync('vercel env ls', { encoding: 'utf8' });
  console.log('📋 Vercel Environment Variables:');
  console.log(result);
  
  console.log('\n💡 To get the MONGODB_URI value, run:');
  console.log('vercel env pull .env.production');
  console.log('cat .env.production | grep MONGODB_URI');
  
  console.log('\n🚀 To import portfolio to production, run:');
  console.log('vercel env pull .env.production');
  console.log('source .env.production && node scripts/importPortfolioProduction.js');
  
} catch (error) {
  console.error('❌ Error getting Vercel environment variables:', error.message);
  console.log('\n💡 Alternative methods:');
  console.log('1. Check your Vercel dashboard > Project Settings > Environment Variables');
  console.log('2. Or run: vercel env ls --scope=your-team-name');
} 