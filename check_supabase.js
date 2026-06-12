const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking Supabase connection and tables...");
  
  // 1. Check fabrics table
  const { data, error } = await supabase.from('fabrics').select('*').limit(1);
  if (error) {
    console.error("Error querying 'fabrics' table:", error.message);
  } else {
    console.log("Successfully connected! 'fabrics' table exists. Rows count in select:", data.length);
  }

  // 2. Check storage bucket
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error("Error listing storage buckets:", bucketError.message);
  } else {
    console.log("Successfully listed storage buckets! Existing buckets:", buckets.map(b => b.name));
    const hasBucket = buckets.some(b => b.name === 'fabric-images');
    console.log("Does 'fabric-images' bucket exist?", hasBucket);
  }
}

check();
