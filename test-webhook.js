#!/usr/bin/env node

/**
 * Quick test script for AI server webhook
 * Usage: node test-webhook.js [server-url]
 */

const AI_SERVER_URL = process.argv[2] || process.env.AI_SERVER_URL || 'http://localhost:3001';

async function testWebhook() {
  console.log(`🧪 Testing webhook at: ${AI_SERVER_URL}/api/webhook/change\n`);

  const testNotification = {
    event: 'song_submitted',
    data: {
      songName: 'Test Song',
      artistName: 'Test Artist',
      userId: 'user_test_123',
      userName: 'Test User',
      releaseDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      releaseDateFormatted: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      daysUntilRelease: 3,
      releaseType: 'single',
      genre: 'Hip-Hop',
      promoIdeas: 'Social media campaign, music video release',
      songId: 'catalog_test_123',
      hasCover: true,
    },
    notifyAdmins: true,
    notifyCEO: false,
    priority: 'high',
    timestamp: new Date().toISOString(),
  };

  try {
    console.log('📤 Sending test notification...');
    console.log('Event:', testNotification.event);
    console.log('Priority:', testNotification.priority);
    console.log('Song:', testNotification.data.songName);
    console.log('Artist:', testNotification.data.artistName);
    console.log('');

    const response = await fetch(`${AI_SERVER_URL}/api/webhook/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testNotification),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`📥 Response Status: ${response.status} ${response.statusText}`);
    console.log('📥 Response Body:', JSON.stringify(responseData, null, 2));
    console.log('');

    if (response.ok) {
      console.log('✅ Webhook test successful!');
      console.log('Check your SMS provider to see if messages were sent.');
    } else {
      console.log('❌ Webhook test failed!');
      console.log('Check your server logs for errors.');
    }
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    console.error('');
    console.error('Common issues:');
    console.error('1. Is your AI server running?');
    console.error('2. Is the URL correct?', AI_SERVER_URL);
    console.error('3. Is the endpoint /api/webhook/change?');
    console.error('4. Check firewall/network settings');
  }
}

// Test question notification
async function testQuestion() {
  console.log(`\n🧪 Testing question webhook...\n`);

  const testQuestion = {
    event: 'artist_question',
    data: {
      question: 'How do I upload multiple songs for an album?',
      artistName: 'Test Artist',
      artistId: 'user_test_123',
      userName: 'Test User',
      context: 'Release Request Form',
      category: 'release',
      urgency: 'high',
      contactMethod: 'both',
      timestamp: new Date().toISOString(),
    },
    notifyAdmins: true,
    notifyCEO: false,
    priority: 'high',
    timestamp: new Date().toISOString(),
  };

  try {
    console.log('📤 Sending test question...');
    const response = await fetch(`${AI_SERVER_URL}/api/webhook/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testQuestion),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`📥 Response: ${response.status}`);
    console.log('📥 Body:', JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('✅ Question test successful!');
    } else {
      console.log('❌ Question test failed!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run tests
(async () => {
  await testWebhook();
  await testQuestion();
})();

