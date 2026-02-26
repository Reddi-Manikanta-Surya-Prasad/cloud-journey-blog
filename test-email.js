
import { generateClient } from 'aws-amplify/data';
import { Amplify } from 'aws-amplify';
import outputs from './amplify_outputs.json' assert { type: 'json' };

Amplify.configure(outputs);
const client = generateClient();

async function testEmail() {
  try {
    console.log('Testing email deletion workflow...');
    const result = await client.mutations.sendDeletionEmail({
      subject: 'Test Deletion Workflow',
      body: 'This is a test body.',
      userEmail: 'surya.prasad@suryareddi.in',
      reason: 'Testing the new Zoho SMTP integration',
      postCount: 5,
      commentCount: 12,
      savedCount: 3
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmail();
