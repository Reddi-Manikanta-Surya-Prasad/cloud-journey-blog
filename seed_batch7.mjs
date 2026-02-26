// seed_batch7.mjs — Messaging: SQS + SNS + EventBridge + Step Functions + SES
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch7.mjs
import { Amplify } from 'aws-amplify'
import { signIn } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const outputs = require('./amplify_outputs.json')
Amplify.configure(outputs)
const client = generateClient()
const EMAIL = process.env.ADMIN_EMAIL, PASS = process.env.ADMIN_PASS
if (!EMAIL || !PASS) { console.error('Set ADMIN_EMAIL and ADMIN_PASS'); process.exit(1) }

const AUTHOR_SUB = 'f4d8c458-5041-70a1-c8f6-c2c26a6819e3'
const AUTHOR_NAME = 'Cloud Journey'

const posts = [
    {
        title: 'Amazon SQS – Reliable Message Queuing for Decoupled Architectures',
        skillLevel: 'intermediate', timeToPracticeMins: 40,
        tldr: 'SQS decouples producers from consumers. Standard queues deliver at least once with high throughput. FIFO queues guarantee exactly-once, ordered delivery for financial transactions.',
        beginnerSummary: 'SQS is a message queue — a buffer between services. When your app receives an order, it puts a message in SQS. A separate worker reads from SQS and processes it. If the worker crashes, the message stays in the queue and retries.',
        proSummary: 'Standard queues: unlimited throughput, at-least-once delivery, best-effort ordering. FIFO: 3,000 msg/s with batching, exactly-once, strict ordering per MessageGroupId. Visibility timeout must exceed processing time or messages redeliver. Message deduplication ID prevents duplicates in FIFO within 5-min window.',
        whyMatters: 'Without SQS, a spike in orders crashes your payment service. With SQS, orders queue up and process at a sustainable rate. This pattern (load leveling) prevents 99% of cascade failures in distributed systems.',
        commonMistakes: 'Setting visibility timeout too low (causes duplicate processing). Not using DLQ (failed messages disappear after max receives). Using Standard queue when exactly-once semantics matter for payments.',
        nextTopicTitle: 'Amazon SNS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon SQS – Simple Queue Service

> 📚 [SQS Developer Guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/) | [SQS FIFO](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues.html)

### Standard vs FIFO

| Feature | Standard | FIFO |
|---|---|---|
| Throughput | Unlimited | 3,000 msg/s (batching), 300/s (no batching) |
| Delivery | At-least-once | Exactly-once |
| Ordering | Best-effort | Strict (per MessageGroupId) |
| Price/M msgs | $0.40 | $0.50 |
| Use case | Order processing, notifications | Financial transactions, inventory |

### Architecture: Load Leveling for Order Processing

\`\`\`mermaid
flowchart LR
    WEB[Web App\nReceives 10k orders/min] --> SQS[SQS FIFO Queue\norders.fifo]
    SQS --> W1[Order Worker\nLambda ×1-20]
    SQS --> W2[Order Worker\nLambda ×1-20]
    W1 --> DB[RDS Orders DB\nMax 100 writes/sec]
    W2 --> DB
    SQS -->|After 3 failures| DLQ[Dead Letter Queue\nManual review]
\`\`\`

### Create FIFO Queue with DLQ

\`\`\`bash
# Create DLQ first
aws sqs create-queue --queue-name orders-dlq.fifo \\
  --attributes FifoQueue=true,ContentBasedDeduplication=true

# Create main FIFO queue
aws sqs create-queue --queue-name orders.fifo \\
  --attributes '{
    "FifoQueue": "true",
    "ContentBasedDeduplication": "true",
    "VisibilityTimeout": "60",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:123:orders-dlq.fifo\",\"maxReceiveCount\":\"3\"}"
  }'
\`\`\`

### Send and Receive Messages

\`\`\`python
import boto3, json

sqs = boto3.client('sqs')
QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123/orders.fifo'

# Send message (FIFO requires MessageGroupId + deduplication)
sqs.send_message(
    QueueUrl=QUEUE_URL,
    MessageBody=json.dumps({'orderId': 'ORD-2025-001', 'amount': 99.99}),
    MessageGroupId='order-processing',
    MessageDeduplicationId='ORD-2025-001'  # Idempotency within 5 min
)

# Receive and process
response = sqs.receive_message(
    QueueUrl=QUEUE_URL,
    MaxNumberOfMessages=10,
    VisibilityTimeout=60,
    WaitTimeSeconds=20  # Long polling — reduces empty receives by 98%
)

for msg in response.get('Messages', []):
    body = json.loads(msg['Body'])
    try:
        process_order(body)
        sqs.delete_message(QueueUrl=QUEUE_URL, ReceiptHandle=msg['ReceiptHandle'])
    except Exception as e:
        # Don't delete — visibility timeout expires → message reappears → retried → DLQ
        print(f"Failed: {e}")
\`\`\``
    },
    {
        title: 'Amazon SNS & EventBridge – Pub/Sub and Event-Driven Architecture',
        skillLevel: 'intermediate', timeToPracticeMins: 45,
        tldr: 'SNS delivers messages to many subscribers (fan-out). EventBridge routes events between AWS services and SaaS with rich filtering rules. Together they enable event-driven microservices.',
        beginnerSummary: 'SNS is a notification broadcaster — when one thing happens, it tells many others. EventBridge is a smarter event router — it filters events and sends them to the right destination based on rules you define.',
        proSummary: 'SNS fan-out: 1 publish → 12.5M subscriptions. Message filtering saves per-delivery cost. FIFO Topic = strict ordering with SQS FIFO subscribers. EventBridge: 28 SaaS partners, Schema Registry auto-discovers event structure. EventBridge Pipes: source → filter → enrich → target without Lambda code.',
        whyMatters: 'Event-driven architecture is how Netflix, Uber, and Airbnb build resilient systems. One order event can trigger payment, inventory, email, analytics, and fraud detection simultaneously — without services knowing about each other.',
        commonMistakes: 'Using SNS for ordered events (use FIFO Topic + FIFO SQS). Not using message filtering (all subscribers receive all messages, wasting cost). Using EventBridge for simple queue patterns (SQS is cheaper for that).',
        nextTopicTitle: 'AWS Step Functions', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## SNS & EventBridge – Event-Driven Architecture

> 📚 [SNS Developer Guide](https://docs.aws.amazon.com/sns/latest/dg/) | [EventBridge User Guide](https://docs.aws.amazon.com/eventbridge/latest/userguide/)

### SNS Fan-Out Pattern

\`\`\`mermaid
flowchart LR
    ORDER[Order Service\nPublish to SNS] --> TOPIC[SNS Topic\norders]
    TOPIC --> SQS1[SQS Queue\nPayment Worker]
    TOPIC --> SQS2[SQS Queue\nInventory Worker]
    TOPIC --> SQS3[SQS Queue\nEmail Worker]
    TOPIC --> LAMBDA[Lambda\nFraud Detection]
    SQS1 --> PAY[Payment Service]
    SQS2 --> INV[Inventory Service]
    SQS3 --> EMAIL[Email Service]
\`\`\`

\`\`\`bash
# Create topic and subscribe SQS queues
aws sns create-topic --name orders
aws sns subscribe --topic-arn arn:aws:sns:...orders \\
  --protocol sqs --notification-endpoint arn:aws:sqs:...payment-queue

# Message filtering — email queue only gets CONFIRMED orders
aws sns set-subscription-attributes \\
  --subscription-arn arn:aws:sns:...email-sub \\
  --attribute-name FilterPolicy \\
  --attribute-value '{"status": ["CONFIRMED", "SHIPPED"], "amount": [{"numeric": [">", 0]}]}'
\`\`\`

### EventBridge Rules – Route Events by Pattern

\`\`\`bash
# Route EC2 state changes to Lambda
aws events put-rule \\
  --name ec2-stopped-alert \\
  --event-pattern '{
    "source": ["aws.ec2"],
    "detail-type": ["EC2 Instance State-change Notification"],
    "detail": {"state": ["stopped", "terminated"]}
  }' \\
  --state ENABLED

aws events put-targets \\
  --rule ec2-stopped-alert \\
  --targets '[{
    "Id": "notify-lambda",
    "Arn": "arn:aws:lambda:us-east-1:123:function:ec2-monitor"
  }]'
\`\`\`

### EventBridge Pipes – Source to Target Without Lambda

\`\`\`bash
# DynamoDB Stream → filter → enrich → EventBridge → Step Functions
aws pipes create-pipe \\
  --name order-to-fulfillment \\
  --source arn:aws:dynamodb:...orders/stream \\
  --source-parameters '{"DynamoDBStreamParameters":{"BatchSize":10,"StartingPosition":"LATEST"}}' \\
  --filter-criteria '{"Filters":[{"Pattern":"{\"dynamodb\":{\"NewImage\":{\"status\":{\"S\":[\"CONFIRMED\"]}}}}"}]}' \\
  --target arn:aws:states:...fulfillment-workflow \\
  --target-parameters '{"StepFunctionStateMachineParameters":{"InvocationType":"FIRE_AND_FORGET"}}'
\`\`\``
    },
    {
        title: 'AWS Step Functions – Orchestrate Serverless Workflows',
        skillLevel: 'advanced', timeToPracticeMins: 60,
        tldr: 'Step Functions orchestrates multi-step workflows with branching, parallel execution, retries, and waits. Express Workflows handle high-throughput event processing; Standard Workflows handle long-running business processes.',
        beginnerSummary: 'Step Functions is a visual workflow engine. Instead of writing complex code with if/else, retries, and timeouts, you draw a flowchart and Step Functions runs it reliably at any scale.',
        proSummary: 'Standard Workflows: exactly-once, up to 1 year, 2,000 state transitions/sec, full audit history. Express Workflows: at-least-once, up to 5 min, 100,000 executions/sec, lower cost. SDK integrations (optimistic/pessimistic) call AWS services directly without Lambda. Waitfor TaskToken suspends execution until a callback.',
        whyMatters: 'Implementing multi-step business processes in Lambda code leads to complex, untestable spaghetti. Step Functions provides a visual, auditable, retry-aware execution graph that\'s automatically fault-tolerant.',
        commonMistakes: 'Using Standard Workflow for high-frequency (>2000/sec) event processing (use Express). Not using .waitForTaskToken for human approval steps. Not setting TimeoutSeconds on states (workflow hangs forever on Lambda timeout).',
        nextTopicTitle: 'Amazon SES', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## AWS Step Functions – Serverless Orchestration

> 📚 [Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/latest/dg/) | [ASL Reference](https://states-language.net/spec.html)

### Order Processing Workflow

\`\`\`mermaid
flowchart TD
    START([Order Received]) --> VAL[Validate Order\nLambda]
    VAL -->|Invalid| FAIL[Fail State\nNotify Customer]
    VAL -->|Valid| PAR[Parallel Branch]
    PAR --> CHARGE[Charge Payment\nLambda]
    PAR --> RESERVE[Reserve Inventory\nDynamoDB SDK]
    CHARGE --> BOTH_DONE{Both succeed?}
    RESERVE --> BOTH_DONE
    BOTH_DONE -->|Yes| FULFILL[Create Fulfillment\nSQS SendMessage]
    BOTH_DONE -->|Payment failed| COMP[Compensate Inventory\nDynamoDB SDK]
    FULFILL --> WAIT[Wait for Shipment\nwaitForTaskToken]
    WAIT --> NOTIFY[Notify Customer\nSNS Publish]
    NOTIFY --> END([Complete])
\`\`\`

### State Machine Definition (ASL)

\`\`\`json
{
  "Comment": "Order Processing Workflow",
  "StartAt": "ValidateOrder",
  "States": {
    "ValidateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123:function:validate-order",
      "Retry": [{
        "ErrorEquals": ["Lambda.ServiceException"],
        "IntervalSeconds": 2, "MaxAttempts": 3, "BackoffRate": 2
      }],
      "Catch": [{"ErrorEquals": ["ValidationError"], "Next": "OrderFailed"}],
      "Next": "ProcessInParallel"
    },
    "ProcessInParallel": {
      "Type": "Parallel",
      "Branches": [
        {"StartAt": "ChargePayment", "States": {"ChargePayment": {"Type": "Task", "Resource": "arn:...charge", "End": true}}},
        {"StartAt": "ReserveInventory", "States": {"ReserveInventory": {
          "Type": "Task",
          "Resource": "arn:aws:states:::dynamodb:updateItem",
          "Parameters": {
            "TableName": "inventory",
            "Key": {"productId": {"S.$": "$.productId"}},
            "UpdateExpression": "SET available = available - :qty",
            "ExpressionAttributeValues": {":qty": {"N.$": "States.JsonToString($.quantity)"}}
          },
          "End": true
        }}}
      ],
      "Next": "SendToFulfillment"
    },
    "WaitForShipment": {
      "Type": "Task",
      "Resource": "arn:aws:states:::sqs:sendMessage.waitForTaskToken",
      "Parameters": {
        "QueueUrl": "https://sqs..../fulfillment",
        "MessageBody": {"orderId.$": "$.orderId", "taskToken.$": "$$.Task.Token"}
      },
      "HeartbeatSeconds": 3600,
      "Next": "NotifyCustomer"
    }
  }
}
\`\`\``
    },
    {
        title: 'Amazon SES – Transactional & Bulk Email at Scale',
        skillLevel: 'intermediate', timeToPracticeMins: 35,
        tldr: 'SES sends transactional and marketing emails from verified domains. Use dedicated IPs for reputation control, Suppression Lists to avoid bounces, and Virtual Deliverability Manager to diagnose inbox issues.',
        beginnerSummary: 'SES is AWS\'s email sending service. Whether you\'re sending one password reset email or a million newsletter emails, SES handles delivery, bounces, and spam complaints automatically.',
        proSummary: 'SES v2 API: SendEmail action vs older SendRawMessage. DKIM (RSA-2048), SPF, DMARC all required for inbox delivery. Dedicated IP groups for sender reputation isolation. Configuration Sets attach event destinations to track opens, clicks, bounces per campaign. VDM (Virtual Deliverability Manager) shows predictive inbox placement.',
        whyMatters: 'A misconfigured email service sends your transactional emails to spam. SES + DKIM/DMARC + suppression list + configuration sets is the difference between 99% inbox delivery and <50%.',
        commonMistakes: 'Not setting up SPF, DKIM, and DMARC (emails go to spam). Not handling bounce and complaint notifications via SNS (your IP gets blacklisted). Sending marketing mail from the same configuration set as transactional (one spam complaint affects all).',
        nextTopicTitle: 'Amazon Athena', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon SES – Email Sending at Scale

> 📚 [SES Developer Guide](https://docs.aws.amazon.com/ses/latest/dg/) | [Email Authentication](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication.html)

### Email Deliverability Stack

\`\`\`mermaid
flowchart LR
    APP[Application] -->|SendEmail API| SES[Amazon SES\nConfiguration Set]
    SES -->|DKIM signed| ISP[Gmail / Outlook\nInbox]
    SES -->|Event| SNS_BOUNCE[SNS Bounce Topic]
    SES -->|Event| SNS_COMP[SNS Complaint Topic]
    SNS_BOUNCE --> LAMBDA[Lambda\nUpdate Suppression List]
    SNS_COMP --> LAMBDA
    LAMBDA --> DDB[DynamoDB\nSuppression List]
\`\`\`

### Domain Identity Setup

\`\`\`bash
# Create and verify domain identity
aws sesv2 create-email-identity \\
  --email-identity example.com \\
  --dkim-signing-attributes NextSigningKeyLength=RSA_2048_BIT

# Add DNS records returned (DKIM, SPF, DMARC)
# SPF:   "v=spf1 include:amazonses.com ~all"
# DKIM:  3 CNAME records → SES auto-rotates keys
# DMARC: "v=DMARC1; p=quarantine; ruf=mailto:dmarc@example.com; pct=100"
\`\`\`

### Send Transactional Email (SES v2)

\`\`\`python
import boto3

ses = boto3.client('sesv2', region_name='us-east-1')

def send_welcome_email(to_email: str, name: str):
    ses.send_email(
        FromEmailAddress='support@example.com',
        Destination={'ToAddresses': [to_email]},
        Content={'Simple': {
            'Subject': {'Data': f'Welcome to CloudJourney, {name}!'},
            'Body': {
                'Html': {'Data': f'<h1>Welcome {name}</h1><p>Your account is ready.</p>'},
                'Text': {'Data': f'Welcome {name}! Your account is ready.'}
            }
        }},
        ConfigurationSetName='transactional-emails',  # Tracks events separately from marketing
        EmailTags=[
            {'Name': 'email-type', 'Value': 'welcome'},
            {'Name': 'user-tier', 'Value': 'free'}
        ]
    )
\`\`\`

### Bounce Handler (Protect Sender Reputation)

\`\`\`python
def handle_ses_event(event, context):
    for record in event['Records']:
        msg = json.loads(record['Sns']['Message'])
        notification_type = msg['notificationType']

        if notification_type == 'Bounce':
            for recipient in msg['bounce']['bouncedRecipients']:
                if msg['bounce']['bounceType'] == 'Permanent':
                    # Add to suppression list — never email again
                    ses.put_suppressed_destination(
                        EmailAddress=recipient['emailAddress'],
                        Reason='BOUNCE'
                    )
        elif notification_type == 'Complaint':
            for recipient in msg['complaint']['complainedRecipients']:
                ses.put_suppressed_destination(
                    EmailAddress=recipient['emailAddress'],
                    Reason='COMPLAINT'    # Treat complaints same as hard bounces
                )
\`\`\``
    },
]

async function main() {
    console.log('Signing in as', EMAIL, '...')
    const { isSignedIn } = await signIn({ username: EMAIL, password: PASS })
    if (!isSignedIn) { console.error('Sign in failed'); process.exit(1) }
    console.log('Signed in. Creating', posts.length, 'posts...\n')
    for (const [i, p] of posts.entries()) {
        const { data, errors } = await client.models.Post.create({
            title: p.title, content: p.content, skillLevel: p.skillLevel,
            tldr: p.tldr, beginnerSummary: p.beginnerSummary, proSummary: p.proSummary,
            whyMatters: p.whyMatters, commonMistakes: p.commonMistakes,
            timeToPracticeMins: p.timeToPracticeMins, nextTopicTitle: p.nextTopicTitle,
            versionLabel: p.versionLabel, authorSub: p.authorSub, authorName: p.authorName,
        })
        if (errors?.length) console.error(`[${i + 1}/${posts.length}] FAIL: ${p.title}`, errors)
        else console.log(`[${i + 1}/${posts.length}] ✓ ${p.title} (${data.id})`)
        await new Promise(r => setTimeout(r, 400))
    }
    console.log('\nDone!')
}
main().catch(e => { console.error(e); process.exit(1) })
