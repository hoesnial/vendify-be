const axios = require('axios');
const { supabase } = require('./config/supabase');

async function testPaymentFlow() {
  const ORDER_ID = `TEST-ORDER-${Date.now()}`;
  console.log(`🚀 Starting Payment Flow Test for Order: ${ORDER_ID}`);

  try {
    // 1. Create a Pending Order in Supabase
    console.log('\n1️⃣  Creating Test Order...');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        id: ORDER_ID,
        machine_id: 'VM01',
        product_id: 1, // Le Mineral
        slot_id: 1,    // Slot 1
        quantity: 1,
        total_amount: 5000,
        status: 'PENDING',
        payment_token: 'dummy-token',
        payment_url: 'dummy-url',
        expires_at: new Date(Date.now() + 3600000).toISOString()
      })
      .select()
      .single();

    if (orderError) throw new Error(`Create Order Failed: ${orderError.message}`);
    console.log('✅ Order Created:', order.id);

    // 2. Create Payment Record
    console.log('\n2️⃣  Creating Payment Record...');
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: ORDER_ID,
        amount: 5000,
        status: 'PENDING'
      });

    if (paymentError) throw new Error(`Create Payment Failed: ${paymentError.message}`);
    console.log('✅ Payment Record Created');

    // 3. Simulate Midtrans Webhook
    console.log('\n3️⃣  Simulating Midtrans Webhook...');
    const webhookPayload = {
      order_id: ORDER_ID,
      transaction_status: 'settlement', // Successful payment
      transaction_id: `TRX-${Date.now()}`,
      payment_type: 'gopay',
      gross_amount: 5000,
      signature_key: 'dummy-signature'
    };

    const response = await axios.post('http://localhost:3001/api/payments/webhook', webhookPayload);
    console.log(`✅ Webhook Response: ${response.status} ${response.statusText}`);
    console.log('   Response Data:', response.data);

    // 4. Verify Dispense Trigger (Check Logs)
    console.log('\n4️⃣  Verifying Dispense/MQTT Trigger...');
    console.log('   Waiting 3 seconds for async processing...');
    await new Promise(r => setTimeout(r, 3000));

    const { data: log, error: logError } = await supabase
      .from('dispense_logs')
      .select('*')
      .eq('order_id', ORDER_ID)
      .single();

    if (logError && logError.code !== 'PGRST116') console.error('   Query Error:', logError.message);

    if (log) {
      console.log('✅ SUCCESS! Dispense Log found:');
      console.log(`   - Machine: ${log.machine_id}`);
      console.log(`   - Slot: ${log.slot_number}`);
      console.log(`   - Sent At: ${log.command_sent_at}`);
      console.log('\n🎉 The system works! Payment -> Webhook -> Dispense Log -> MQTT Command');
    } else {
      console.error('❌ FAILED: No dispense log found. MQTT command likely NOT sent.');
      console.log('   Check backend console logs for errors.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
       console.error('   Server Response:', error.response.data);
    }
  }
}

testPaymentFlow();
