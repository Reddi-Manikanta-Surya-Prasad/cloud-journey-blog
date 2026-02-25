// seed_posts.mjs — run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_posts.mjs
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

/* ─── POST DATA ──────────────────────────────────────────────────────────── */
const posts = [

    /* ═══════════════════════════════════════════════ 1. EC2 */
    {
        title: 'Amazon EC2 – Scalable Virtual Servers in the Cloud',
        skillLevel: 'beginner',
        tldr: 'EC2 lets you rent virtual machines on AWS — choose OS, CPU, RAM, and pay only while it runs.',
        beginnerSummary: 'Think of EC2 like renting a computer from AWS. You pick how powerful it is, install your software, and pay only while it runs. No upfront hardware cost.',
        proSummary: 'EC2 spans 5 instance families, 3 purchase models (On-Demand/Reserved/Spot), integrates with ASG+ELB for HA. Placement Groups optimize proximity. Nitro hypervisor delivers near bare-metal perf. IMDSv2 requires session-oriented metadata calls.',
        whyMatters: 'EC2 underpins most AWS workloads. Mastering instance selection, pricing, and Auto Scaling separates cost-effective architectures from over-provisioned ones.',
        commonMistakes: 'Leaving instances running when idle; using On-Demand for steady workloads (use Reserved); ignoring Spot for fault-tolerant jobs; not using Auto Scaling.',
        timeToPracticeMins: 30,
        nextTopicTitle: 'Amazon VPC',
        versionLabel: '2025',
        content: `## Amazon EC2 – Elastic Compute Cloud

> 📚 [Official Docs](https://docs.aws.amazon.com/ec2/latest/userguide/)

---

## 🟢 Beginner Level

**What is EC2?**
EC2 is a virtual machine in AWS's data center. You choose the OS (Amazon Linux, Ubuntu, Windows), the size (CPU/RAM), and launch it in minutes.

**Key terms:**
- **Instance** – A running virtual machine
- **AMI (Amazon Machine Image)** – The OS + pre-installed software snapshot used to launch an instance
- **Instance Type** – The hardware profile (e.g. \`t3.micro\` = 2 vCPU, 1 GB RAM)
- **Key Pair** – SSH credentials to log in to Linux instances
- **Security Group** – Firewall rules (e.g. allow port 22 for SSH, port 80 for HTTP)

**Launch your first EC2 instance (Console):**
1. Go to EC2 → Launch Instance
2. Choose **Amazon Linux 2023** AMI
3. Select **t3.micro** (free tier)
4. Create or select a Key Pair
5. Allow SSH (port 22) in Security Group
6. Launch → SSH in: \`ssh -i key.pem ec2-user@<public-ip>\`

---

## 🟡 Intermediate Level

**Instance Families:**
| Family | Optimized For | Examples |
|---|---|---|
| General Purpose | Balanced CPU/RAM/Network | t3, m6i |
| Compute | High CPU | c6i, c7g |
| Memory | Large RAM for DBs | r6i, x2idn |
| Storage | High local I/O | i4i, d3 |
| Accelerated | GPU / ML | p4, g5 |

**Pricing Models:**
| Model | Savings | Use When |
|---|---|---|
| On-Demand | 0% | Dev/Test, unpredictable |
| Reserved (1yr) | ~40% | Steady production workloads |
| Reserved (3yr) | ~60% | Long-term committed workloads |
| Spot | ~90% | Fault-tolerant batch jobs |
| Savings Plans | ~66% | Flexible committed spend |

**Auto Scaling + Load Balancer Architecture:**

\`\`\`mermaid
graph LR
    U[Users] --> ALB[Application Load Balancer]
    ALB --> EC2a[EC2 AZ-a]
    ALB --> EC2b[EC2 AZ-b]
    ASG[Auto Scaling Group] -.manages.-> EC2a
    ASG -.manages.-> EC2b
    CW[CloudWatch Alarm\nCPU > 70%] --> ASG
\`\`\`

---

## 🔴 Advanced Level

**Placement Groups:**
- **Cluster** – All instances in one rack, ultra-low latency (HPC). Single AZ.
- **Spread** – Each instance on separate hardware, max availability. Max 7/AZ.
- **Partition** – Groups of instances in separate racks (Hadoop, Kafka).

**User Data (bootstrap script):**
\`\`\`bash
#!/bin/bash
yum update -y
yum install -y httpd
systemctl start httpd
systemctl enable httpd
echo "<h1>Hello from $(hostname)</h1>" > /var/www/html/index.html
\`\`\`

**IMDSv2 (secure metadata access):**
\`\`\`bash
# Get token first (required in IMDSv2)
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
# Use token for metadata
curl -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id
\`\`\`

**Hibernate:**
Save RAM state to EBS, restore in seconds. Instance must have encrypted EBS root volume.

---

## ⚫ Pro / Expert Level

**Real-World Architecture – Highly Available Web App:**

\`\`\`mermaid
graph TD
    R53[Route 53\nLatency Routing] --> CF[CloudFront CDN]
    CF --> ALB[ALB across 3 AZs]
    ALB --> ASG[Auto Scaling Group]
    ASG --> EC2a[EC2 t3.large\nAZ-us-east-1a]
    ASG --> EC2b[EC2 t3.large\nAZ-us-east-1b]
    ASG --> EC2c[EC2 t3.large\nAZ-us-east-1c]
    EC2a --> RDS[RDS Aurora\nMulti-AZ]
    EC2b --> RDS
    EC2c --> RDS
    EC2a --> ElastiCache[ElastiCache Redis]
    EC2b --> ElastiCache
\`\`\`

**Cost Optimization Strategy:**
- Use **Spot Fleet** with \`diversified\` strategy across instance types and AZs
- Define **Spot interruption handler** via EventBridge → Lambda to drain connections
- Track Spot savings with **AWS Cost Explorer**

**CloudFormation EC2 with SSM (no SSH keys needed):**
\`\`\`yaml
Resources:
  MyInstance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: t3.micro
      ImageId: !Ref LatestAMI
      IamInstanceProfile: !Ref SSMInstanceProfile
      Tags:
        - Key: Environment
          Value: Production
\`\`\`

> Access via: **AWS Systems Manager Session Manager** — zero open ports, full audit trail.`
    },

    /* ═══════════════════════════════════════════════ 2. S3 */
    {
        title: 'Amazon S3 – Object Storage for the Internet Scale',
        skillLevel: 'beginner',
        tldr: 'S3 stores files in buckets with 11 nines durability — from static websites to data lake foundations.',
        beginnerSummary: 'S3 is like a giant unlimited hard drive in the cloud. Upload any file to a "bucket" and access it from anywhere. AWS guarantees it will never lose your data.',
        proSummary: 'S3 uses CRR/SRR for replication, S3 Select for in-place querying, Intelligent-Tiering for auto cost optimization, Object Lock for WORM compliance, and EventBridge notifications for event-driven pipelines. Multipart Upload handles files >100 MB.',
        whyMatters: 'S3 is the connective tissue of AWS — used for backups, static hosting, data lakes, Lambda deployment packages, CloudFront origins, and inter-service data exchange.',
        commonMistakes: 'Accidental public access; not enabling versioning; ignoring lifecycle rules; storing millions of small files without grouping (use partitioning).',
        timeToPracticeMins: 20,
        nextTopicTitle: 'AWS Lambda',
        versionLabel: '2025',
        content: `## Amazon S3 – Simple Storage Service

> 📚 [Official Docs](https://docs.aws.amazon.com/s3/latest/userguide/)

---

## 🟢 Beginner Level

**Core Concepts:**
- **Bucket** – Container for objects. Name must be globally unique.
- **Object** – A file + metadata, identified by a **key** (path-like name)
- **Key example:** \`photos/2025/january/sunset.jpg\`
- **Max object size:** 5 TB (use Multipart Upload above 100 MB)

**Upload file via AWS CLI:**
\`\`\`bash
# Create bucket
aws s3 mb s3://my-unique-bucket-name

# Upload file
aws s3 cp ./photo.jpg s3://my-unique-bucket-name/photos/photo.jpg

# Download file
aws s3 cp s3://my-unique-bucket-name/photos/photo.jpg ./local.jpg

# List objects
aws s3 ls s3://my-unique-bucket-name/photos/
\`\`\`

**Static Website Hosting:**
1. Enable "Static website hosting" on bucket
2. Set index.html and error.html
3. Set bucket policy to allow public read
4. Access via bucket website endpoint

---

## 🟡 Intermediate Level

**Storage Classes – Choose Based on Access Pattern:**
| Class | Retrieval | Min Duration | Cost |
|---|---|---|---|
| Standard | ms | None | Highest |
| Intelligent-Tiering | ms | None | Auto |
| Standard-IA | ms | 30 days | Lower |
| One Zone-IA | ms | 30 days | Cheaper |
| Glacier Instant | ms | 90 days | Low |
| Glacier Flexible | 1-5 min | 90 days | Very Low |
| Glacier Deep Archive | 12 hr | 180 days | Lowest |

**Lifecycle Policy (move to Glacier after 90 days, delete after 365):**
\`\`\`json
{
  "Rules": [{
    "Status": "Enabled",
    "Filter": { "Prefix": "logs/" },
    "Transitions": [
      { "Days": 90, "StorageClass": "GLACIER" }
    ],
    "Expiration": { "Days": 365 }
  }]
}
\`\`\`

**S3 Data Pipeline Architecture:**

\`\`\`mermaid
graph LR
    App[Application] -->|PutObject| S3[S3 Bucket]
    S3 -->|Event Notification| Lambda[Lambda Function]
    Lambda -->|Process & Store| DDB[DynamoDB]
    S3 -->|CRR| S3DR[S3 Replica\nDR Region]
\`\`\`

---

## 🔴 Advanced Level

**Versioning + MFA Delete:**
- Versioning keeps all versions of an object (protects against accidental delete)
- MFA Delete requires MFA to permanently delete a version
- Delete marker = soft delete (object hidden but versions preserved)

**Cross-Region Replication (CRR) — via console or CLI:**
\`\`\`bash
aws s3api put-bucket-replication \
  --bucket source-bucket \
  --replication-configuration file://replication.json
\`\`\`

**S3 Select — Query object content directly:**
\`\`\`python
import boto3
s3 = boto3.client('s3')
result = s3.select_object_content(
    Bucket='my-bucket',
    Key='data/sales.csv',
    ExpressionType='SQL',
    Expression="SELECT * FROM S3Object WHERE revenue > 10000",
    InputSerialization={'CSV': {'FileHeaderInfo': 'USE'}},
    OutputSerialization={'JSON': {}}
)
\`\`\`

---

## ⚫ Pro / Expert Level

**S3 as a Data Lake Foundation:**

\`\`\`mermaid
graph TD
    Sources[Data Sources\nRDS / Kinesis / APIs] --> S3Raw[S3 Raw Zone]
    S3Raw --> Glue[AWS Glue ETL]
    Glue --> S3Proc[S3 Processed Zone\nParquet + Partitioned]
    S3Proc --> Athena[Amazon Athena\nSQL Queries]
    S3Proc --> Redshift[Redshift Spectrum]
    S3Proc --> QuickSight[QuickSight\nDashboards]
\`\`\`

**Partition strategy for Athena performance:**
Store data as: \`s3://datalake/events/year=2025/month=02/day=25/file.parquet\`
This allows Athena to skip irrelevant partitions, reducing bytes scanned and cost.

**Object Lock (WORM Compliance):**
\`\`\`bash
# Enable Object Lock at bucket creation (cannot be disabled later)
aws s3api create-bucket --bucket compliance-bucket \
  --object-lock-enabled-for-bucket

# Retain an object for 7 years
aws s3api put-object-retention \
  --bucket compliance-bucket \
  --key "audit/2025-report.pdf" \
  --retention '{"Mode":"COMPLIANCE","RetainUntilDate":"2032-01-01T00:00:00Z"}'
\`\`\``
    },

    /* ═══════════════════════════════════════════════ 3. LAMBDA */
    {
        title: 'AWS Lambda – Serverless Functions at Any Scale',
        skillLevel: 'intermediate',
        tldr: 'Lambda runs code in response to events, scales to zero, and bills per millisecond — no servers to manage.',
        beginnerSummary: 'Lambda is like a vending machine for code. You tell AWS what to run, what to trigger it, and it handles everything — servers, scaling, patching. You only pay when code actually runs.',
        proSummary: 'Lambda execution environment lifecycle: Init→Invoke→Shutdown. SnapStart (Java) eliminates cold starts by snapshotting initialized state. Extensions API enables observability sidecars. Function URLs provide HTTPS endpoints without API Gateway. Lambda Power Tuning Tool optimizes cost/perf tradeoff. Recursive loop detection prevents runaway costs.',
        whyMatters: 'Lambda is the cornerstone of serverless. Mastering its invocation models, concurrency limits, and cold start mitigation is essential for responsive, cost-efficient APIs.',
        commonMistakes: 'Oversized zip packages; missing DLQ on async invocations; timeout set too low; creating a Lambda per API instead of sharing; not using Lambda Layers for shared dependencies.',
        timeToPracticeMins: 45,
        nextTopicTitle: 'Amazon API Gateway',
        versionLabel: '2025',
        content: `## AWS Lambda – Serverless Compute

> 📚 [Official Docs](https://docs.aws.amazon.com/lambda/latest/dg/)

---

## 🟢 Beginner Level

**What is Lambda?**
Upload your code → define a trigger → Lambda runs it automatically. No servers, no capacity planning.

**Write your first Lambda (Node.js):**
\`\`\`javascript
export const handler = async (event) => {
  console.log('Event received:', JSON.stringify(event));
  const name = event.queryStringParameters?.name || 'World';
  return {
    statusCode: 200,
    body: JSON.stringify({ message: \`Hello, \${name}!\` }),
  };
};
\`\`\`

**Deploy via AWS CLI:**
\`\`\`bash
zip function.zip index.mjs
aws lambda create-function \
  --function-name my-hello-fn \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::123456789:role/lambda-basic-role
\`\`\`

---

## 🟡 Intermediate Level

**Invocation Models:**
| Model | Source | On Error |
|---|---|---|
| Synchronous | API Gateway, ALB, SDK | Caller gets error |
| Asynchronous | S3, SNS, EventBridge | Retry 2x → DLQ |
| Event Source Mapping | SQS, Kinesis, DynamoDB Streams | Retry until expired |

**Event-Driven Architecture with Lambda:**

\`\`\`mermaid
graph LR
    S3[S3 Upload] -->|Event| Lambda1[Lambda: Resize Image]
    Lambda1 --> S3out[S3 Thumbnails]
    API[API Gateway] -->|HTTP| Lambda2[Lambda: CRUD API]
    Lambda2 --> DDB[DynamoDB]
    EB[EventBridge\nSchedule] -->|Cron| Lambda3[Lambda: Cleanup Job]
    Lambda3 --> S3del[Delete Old Files]
\`\`\`

**Environment Variables + Secrets:**
\`\`\`javascript
// Use env vars for config
const TABLE_NAME = process.env.TABLE_NAME;
const REGION = process.env.AWS_REGION;

// For secrets — fetch from SSM at cold start
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
const ssm = new SSMClient({});
const { Parameter } = await ssm.send(new GetParameterCommand({
  Name: '/myapp/db-password', WithDecryption: true
}));
\`\`\`

---

## 🔴 Advanced Level

**Cold Start vs Warm Start:**
- **Cold start** – Lambda provisions a new execution environment (~100ms–1s)
- **Warm start** – Environment is reused, only handler runs (~ms)

**Reduce cold starts:**
1. **Provisioned Concurrency** – Pre-warm N environments
2. **SnapStart (Java 21)** – Snapshot after init phase
3. Keep packages small (<50 MB unzipped)
4. Move SDK initialization outside handler

\`\`\`javascript
// ✅ Initialize OUTSIDE handler (reused across invocations)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
const dynamo = new DynamoDBClient({});

export const handler = async (event) => {
  // dynamo client is already warm!
};
\`\`\`

**SQS + Lambda with partial batch failure:**
\`\`\`javascript
export const handler = async (event) => {
  const failures = [];
  for (const record of event.Records) {
    try {
      await processMessage(JSON.parse(record.body));
    } catch (e) {
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  // Only failed messages return to queue
  return { batchItemFailures: failures };
};
\`\`\`

---

## ⚫ Pro / Expert Level

**Full Serverless API Architecture:**

\`\`\`mermaid
graph TD
    Client[Client App] --> CF[CloudFront]
    CF --> API[API Gateway\nHTTP API]
    API --> Auth[Lambda Authorizer\nJWT Validation]
    Auth -->|Valid| Lambda[Lambda Function]
    Lambda --> DDB[DynamoDB\nDAX Cache]
    Lambda --> S3[S3 for media]
    Lambda --> SES[SES for email]
    Lambda --> XRay[X-Ray Tracing]
\`\`\`

**Lambda Power Tuning — find optimal memory:**
\`\`\`bash
# Deploy AWS Lambda Power Tuning tool from SAR
# Run it via Step Functions with your function ARN
# It tests 128MB → 10240MB and plots cost vs speed curve
\`\`\`

**Lambda Extension for observability:**
\`\`\`bash
# Add Datadog or ADOT (AWS Distro for OpenTelemetry) as a layer
aws lambda update-function-configuration \
  --function-name my-fn \
  --layers arn:aws:lambda:us-east-1:464622532012:layer:Datadog-Extension:58
\`\`\``
    },

    /* ═══════════════════════════════════════════════ 4. IAM */
    {
        title: 'AWS IAM – Identity and Access Management Mastery',
        skillLevel: 'intermediate',
        tldr: 'IAM is the security foundation of AWS — controlling who can access what resources and under what conditions.',
        beginnerSummary: 'IAM is the security gatekeeper. It lets you create users, groups, and roles with exactly the permissions they need — nothing more. The golden rule: least privilege always.',
        proSummary: 'IAM policy evaluation: explicit deny → SCP → permission boundary → session policy → identity policy → resource policy. ABAC tags enable scalable permission systems. IAM Roles Anywhere extends IAM to on-premises workloads. Access Analyzer with policy validation catches overly permissive IAM before deployment.',
        whyMatters: 'Every AWS action is an IAM call. Misconfigured IAM is the #1 cause of cloud breaches. Mastering policy evaluation logic prevents privilege escalation vulnerabilities.',
        commonMistakes: 'Using root account; wildcard *, * policies; not rotating keys; embedding credentials in code; missing SCP guardrails; not using IAM Access Analyzer.',
        timeToPracticeMins: 60,
        nextTopicTitle: 'Amazon VPC',
        versionLabel: '2025',
        content: `## AWS IAM – Identity and Access Management

> 📚 [Official Docs](https://docs.aws.amazon.com/iam/latest/userguide/)

---

## 🟢 Beginner Level

**The 4 IAM Identities:**
- **Root User** – All-powerful, only for initial setup + billing. Enable MFA, never use daily.
- **IAM User** – A person. Has username/password + optional access keys.
- **IAM Group** – Collection of users. Attach policies to grant permissions.
- **IAM Role** – No permanent credentials. Assumed temporarily by services, users, or cross-account.

**Create read-only S3 user:**
\`\`\`bash
# Create user
aws iam create-user --user-name alice

# Attach AWS managed policy
aws iam attach-user-policy \
  --user-name alice \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Create access key for CLI
aws iam create-access-key --user-name alice
\`\`\`

---

## 🟡 Intermediate Level

**Policy Structure:**
\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowS3BucketOperations",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-app-bucket/*",
      "Condition": {
        "StringEquals": { "aws:RequestedRegion": "us-east-1" },
        "Bool": { "aws:SecureTransport": "true" }
      }
    },
    {
      "Effect": "Deny",
      "Action": "s3:DeleteBucket",
      "Resource": "*"
    }
  ]
}
\`\`\`

**IAM Role for EC2 (no access keys needed!):**

\`\`\`mermaid
graph LR
    EC2[EC2 Instance] -->|AssumeRole via IMDS| STS[AWS STS]
    STS -->|Temporary Credentials| EC2
    EC2 -->|Use temp creds| S3[S3 Bucket]
    EC2 -->|Use temp creds| DDB[DynamoDB]
\`\`\`

---

## 🔴 Advanced Level

**Policy Evaluation Order:**
1. **Explicit DENY** anywhere → deny (always wins)
2. **SCPs** must allow (Organizations)
3. **Permission Boundary** must allow
4. **Session Policy** must allow (assumed role sessions)
5. **Identity Policy** must allow
6. **Resource Policy** can independently allow (cross-account)

**ABAC (Attribute-Based Access Control):**
\`\`\`json
{
  "Effect": "Allow",
  "Action": "s3:*",
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "s3:ResourceTag/Team": "\${aws:PrincipalTag/Team}"
    }
  }
}
\`\`\`
Tag users with \`Team=backend\` → they can only access S3 buckets tagged \`Team=backend\`.

**Permission Boundary — prevent privilege escalation:**
\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:*", "cloudwatch:*"],
    "Resource": "*"
  }]
}
\`\`\`
A developer with AdministratorAccess + this boundary can ONLY perform S3 and CloudWatch actions.

---

## ⚫ Pro / Expert Level

**Complete IAM Security Architecture:**

\`\`\`mermaid
graph TD
    Root[Root Account\nMFA + No Access Keys] --> Org[AWS Organizations]
    Org --> SCP[Service Control Policies\nGuardrails for all accounts]
    Org --> Dev[Dev Account] & Prod[Prod Account]
    Dev --> DevRole[Developer Role\nPermission Boundary applied]
    Prod --> CIRole[CI/CD Role\nLeast privilege only]
    CIRole --> CodePipeline[CodePipeline]
    DevRole --> AccessAnalyzer[IAM Access Analyzer\nDetects external access]
\`\`\`

**Run AWS IAM Access Analyzer + automate remediations:**
\`\`\`bash
# Enable Access Analyzer
aws accessanalyzer create-analyzer \
  --analyzer-name my-org-analyzer \
  --type ORGANIZATION

# List findings (unintended external access)
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:access-analyzer:us-east-1:123:analyzer/my-org-analyzer
\`\`\`

**Policy validation before deployment:**
\`\`\`bash
# Validate a policy document against IAM best practices
aws accessanalyzer validate-policy \
  --policy-document file://policy.json \
  --policy-type IDENTITY_POLICY
\`\`\``
    },

    /* ═══════════════════════════════════════════════ 5. VPC */
    {
        title: 'Amazon VPC – Build Your Private Network in AWS',
        skillLevel: 'intermediate',
        tldr: 'VPC is your private, isolated network in AWS — you define IP ranges, subnets, routing, and security.',
        beginnerSummary: 'A VPC is like having your own private section in AWS. You control which parts face the internet (public subnet) and which stay hidden (private subnet). Everything inside talks securely.',
        proSummary: 'VPC spans all AZs in a region. Flow logs use Parquet export to S3 for cost-effective analysis. Gateway Endpoints route S3/DynamoDB traffic within AWS backbone. Transit Gateway enables hub-and-spoke for 1000s of VPCs. VPC Lattice provides app-layer service networking across accounts and VPCs.',
        whyMatters: 'Every AWS resource runs inside a VPC. Network design mistakes (oversized CIDRs, public databases, open security groups) are permanent and hard to change post-launch.',
        commonMistakes: 'Everything in public subnets; /26 CIDRs (too small); overlapping CIDRs with on-prem; 0.0.0.0/0 SSH rules; no VPC Flow Logs; single-AZ setup.',
        timeToPracticeMins: 60,
        nextTopicTitle: 'Amazon RDS',
        versionLabel: '2025',
        content: `## Amazon VPC – Virtual Private Cloud

> 📚 [Official Docs](https://docs.aws.amazon.com/vpc/latest/userguide/)

---

## 🟢 Beginner Level

**Core Building Blocks:**
- **VPC** – Your private network (e.g., CIDR \`10.0.0.0/16\` = 65,536 IPs)
- **Subnet** – Subdivision of VPC in one AZ (e.g., \`10.0.1.0/24\` = 256 IPs)
- **Internet Gateway (IGW)** – Allows internet traffic into/out of public subnets
- **Route Table** – Rules that decide where traffic goes
- **Security Group** – Stateful firewall per instance (allow rules only)
- **NACL** – Stateless firewall per subnet (allow + deny rules)

**Simple 2-tier VPC:**

\`\`\`mermaid
graph TB
    Internet((Internet)) --> IGW[Internet Gateway]
    IGW --> PubSub[Public Subnet\n10.0.1.0/24]
    PubSub --> ALB[Load Balancer]
    ALB --> PrivSub[Private Subnet\n10.0.2.0/24]
    PrivSub --> EC2[App Servers]
    PrivSub --> RDS[(RDS Database)]
\`\`\`

---

## 🟡 Intermediate Level

**3-Tier Production VPC Layout:**
\`\`\`
VPC: 10.0.0.0/16

Public Subnets  (ALB, NAT GW, Bastion):
  10.0.1.0/24  (AZ-a)
  10.0.2.0/24  (AZ-b)

Private Subnets (App Servers):
  10.0.11.0/24 (AZ-a)
  10.0.12.0/24 (AZ-b)

Data Subnets   (RDS, ElastiCache):
  10.0.21.0/24 (AZ-a)
  10.0.22.0/24 (AZ-b)
\`\`\`

**Security Group vs NACL:**
| | Security Group | NACL |
|---|---|---|
| Level | Instance | Subnet |
| State | Stateful (return traffic auto-allowed) | Stateless (must allow both directions) |
| Rules | Allow only | Allow + Deny |
| Evaluation | All rules together | Ordered by rule number |

**NAT Gateway for private subnet internet access:**
\`\`\`bash
# Create NAT Gateway in public subnet
aws ec2 create-nat-gateway \
  --subnet-id subnet-public-a \
  --allocation-id eipalloc-12345  # Elastic IP

# Add route in private route table
aws ec2 create-route \
  --route-table-id rtb-private \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id nat-12345
\`\`\`

---

## 🔴 Advanced Level

**VPC Peering vs Transit Gateway:**

\`\`\`mermaid
graph TD
    subgraph "VPC Peering (point-to-point, non-transitive)"
      A[VPC A] <--> B[VPC B]
      A <--> C[VPC C]
      B <-->|Need separate peering| C
    end

    subgraph "Transit Gateway (hub-and-spoke)"
      TGW[Transit Gateway] <--> VPC1[VPC 1]
      TGW <--> VPC2[VPC 2]
      TGW <--> VPC3[VPC 3]
      TGW <--> OnPrem[On-Premises VPN]
    end
\`\`\`

**VPC Endpoints — keep traffic inside AWS:**
- **Gateway Endpoint** – Free. For S3 and DynamoDB. Added to route tables.
- **Interface Endpoint (PrivateLink)** – ENI with private IP. For 100+ AWS services. Hourly cost.

\`\`\`bash
# Create S3 Gateway Endpoint (free)
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxx \
  --service-name com.amazonaws.us-east-1.s3 \
  --route-table-ids rtb-private
\`\`\`

---

## ⚫ Pro / Expert Level

**Multi-Account Network Architecture:**

\`\`\`mermaid
graph TD
    CentralNet[Network Account\nTransit Gateway] --> InspVPC[Inspection VPC\nAWS Network Firewall]
    CentralNet --> SharedSvcs[Shared Services VPC\nDNS, AD, Monitoring]
    CentralNet --> ProdVPC[Production VPC]
    CentralNet --> DevVPC[Dev VPC]
    CentralNet --> OnPrem[On-Premises\nDirect Connect]
    InspVPC -.->|All traffic inspected| ProdVPC
\`\`\`

**VPC Flow Logs → Athena for security analysis:**
\`\`\`sql
-- Find top talkers in your VPC (Athena query)
SELECT srcaddr, dstaddr, SUM(bytes) as total_bytes
FROM vpc_flow_logs
WHERE action = 'ACCEPT'
  AND year = '2025' AND month = '02'
GROUP BY srcaddr, dstaddr
ORDER BY total_bytes DESC
LIMIT 20;
\`\`\``
    },

    /* ═══════════════════════════════════════════════ 6. DynamoDB */
    {
        title: 'Amazon DynamoDB – NoSQL Database for Any Scale',
        skillLevel: 'intermediate',
        tldr: 'DynamoDB delivers single-digit millisecond reads at any scale with zero server management.',
        beginnerSummary: 'DynamoDB is a super-fast database where you store items (like rows) in tables. Unlike SQL databases, you design your table around how you\'ll query it — not around relationships.',
        proSummary: 'DynamoDB uses consistent hashing for partitioning. Each partition handles 3,000 RCU + 1,000 WCU. Hot partitions cause throttling — use high-cardinality PKs or add random suffix (write sharding). Single-table design with overloaded GSI indexes enables 1:N and M:N access patterns without JOINs.',
        whyMatters: 'DynamoDB is the default database for serverless workloads, gaming leaderboards, IoT, and session stores where relational overhead and connection limits are constraints.',
        commonMistakes: 'Using Scan instead of Query; hot partitions; not planning access patterns before schema; over-provisioning capacity; ignoring GSI cost vs table read cost.',
        timeToPracticeMins: 60,
        nextTopicTitle: 'Amazon CloudWatch',
        versionLabel: '2025',
        content: `## Amazon DynamoDB – NoSQL at Scale

> 📚 [Official Docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/)

---

## 🟢 Beginner Level

**Key Concepts:**
- **Table** – Container for items (no schema except primary key)
- **Item** – A single record (max 400 KB)
- **Attribute** – A field on an item (any type, any item)
- **Partition Key (PK)** – Required. Determines which partition stores the item.
- **Sort Key (SK)** – Optional. Enables range queries within a partition.

**Create table and put item (CLI):**
\`\`\`bash
# Create table
aws dynamodb create-table \
  --table-name Users \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# Put an item
aws dynamodb put-item \
  --table-name Users \
  --item '{
    "userId": {"S": "user-001"},
    "name": {"S": "Alice"},
    "email": {"S": "alice@example.com"},
    "createdAt": {"S": "2025-02-25"}
  }'

# Get an item
aws dynamodb get-item \
  --table-name Users \
  --key '{"userId": {"S": "user-001"}}'
\`\`\`

---

## 🟡 Intermediate Level

**Access Patterns drive table design:**

Table: \`BlogPosts\`
| PK | SK | Attributes |
|---|---|---|
| \`USER#alice\` | \`POST#2025-02-25\` | title, content, likes |
| \`USER#alice\` | \`PROFILE\` | email, bio, avatar |
| \`POST#abc\` | \`COMMENT#001\` | text, author, timestamp |

**Query by user (all posts):**
\`\`\`python
import boto3
table = boto3.resource('dynamodb').Table('BlogPosts')

response = table.query(
    KeyConditionExpression='PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues={
        ':pk': 'USER#alice',
        ':prefix': 'POST#'
    }
)
\`\`\`

**GSI for reverse lookup (query posts by date):**

\`\`\`mermaid
graph LR
    Table[Table\nPK=userId SK=postId] -->|GSI| GSI[GSI\nPK=createdDate SK=likes]
    Client -->|Get user's posts| Table
    Client -->|Get top posts today| GSI
\`\`\`

---

## 🔴 Advanced Level

**Write Sharding for high-cardinality writes:**
\`\`\`javascript
// Instead of PK=ProductCategory (hot!), shard it:
const shards = 10;
const shard = Math.floor(Math.random() * shards);
const pk = \`CATEGORY#electronics#\${shard}\`;

// When reading, query all shards in parallel
const queries = Array.from({length: shards}, (_, i) =>
  table.query({ KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': \`CATEGORY#electronics#\${i}\` } })
);
const results = await Promise.all(queries);
\`\`\`

**DynamoDB Streams → Lambda for event sourcing:**
\`\`\`javascript
export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const newItem = record.dynamodb.NewImage;
      console.log('New post created:', newItem.postId.S);
      // Trigger downstream: send email, update cache, etc.
    }
  }
};
\`\`\`

---

## ⚫ Pro / Expert Level

**Single-Table Design — full blog application in one table:**

\`\`\`mermaid
graph TD
    Table[Single DynamoDB Table] --> GSI1[GSI1: byDate\nPK=type SK=createdAt]
    Table --> GSI2[GSI2: byAuthor\nPK=authorId SK=postId]
    Table --> GSI3[GSI3: byTag\nPK=tag SK=likes]
    Client1[Feed Page] -->|Query GSI1| Table
    Client2[Author Profile] -->|Query GSI2| Table
    Client3[Tag Search] -->|Query GSI3| Table
\`\`\`

**Transactions (ACID across items):**
\`\`\`javascript
await dynamo.transactWrite({
  TransactItems: [
    { Update: { // Decrement stock
        TableName: 'Products',
        Key: { productId: { S: 'prod-1' } },
        UpdateExpression: 'SET stock = stock - :val',
        ConditionExpression: 'stock >= :val',
        ExpressionAttributeValues: { ':val': { N: '1' } }
    }},
    { Put: { // Create order
        TableName: 'Orders',
        Item: { orderId: { S: 'ord-999' }, productId: { S: 'prod-1' } }
    }}
  ]
}).promise();
// If stock check fails → entire transaction rolls back
\`\`\``
    },

    /* ═══════════════════════════════════════════════ 7. CloudWatch */
    {
        title: 'Amazon CloudWatch – Full-Stack Observability for AWS',
        skillLevel: 'intermediate',
        tldr: 'CloudWatch is your single pane of glass for metrics, logs, traces, and alarms across all AWS services.',
        beginnerSummary: 'CloudWatch is like a health monitor for your AWS resources. It shows you CPU, memory, errors — and can automatically alert you or take action when something breaks.',
        proSummary: 'CloudWatch Metrics Insights enables cross-account metric math. Embedded Metric Format (EMF) embeds custom metrics directly in structured logs for zero-latency ingestion. Container Insights with enhanced observability uses ADOT Collector. Synthetics Canaries test APIs/UIs on schedule. Alarm composite actions trigger Step Functions for automated remediations.',
        whyMatters: 'Without observability you\'re flying blind. CloudWatch is the entry point to understanding AWS application behavior, detecting regressions, and meeting SLAs.',
        commonMistakes: 'Not setting log retention policies (unlimited = expensive); missing custom metrics for business KPIs; using basic EC2 monitoring when 1-min detail is needed; no composite alarms.',
        timeToPracticeMins: 45,
        nextTopicTitle: 'Amazon SQS',
        versionLabel: '2025',
        content: `## Amazon CloudWatch – Observability Platform

> 📚 [Official Docs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/)

---

## 🟢 Beginner Level

**What Does CloudWatch Give You?**
- **Metrics** – Numeric time-series data (CPU%, request count, error rate)
- **Logs** – Text output from your applications and AWS services
- **Alarms** – Trigger actions when metrics breach thresholds
- **Dashboards** – Visual display of your metrics

**Create a CPU alarm for EC2:**
\`\`\`bash
aws cloudwatch put-metric-alarm \
  --alarm-name "HighCPU" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --dimensions Name=InstanceId,Value=i-1234567890 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123:my-alerts
\`\`\`

---

## 🟡 Intermediate Level

**CloudWatch Logs Insights Query:**
\`\`\`sql
-- Find Lambda cold starts in last 1 hour
fields @timestamp, @message
| filter @message like /Init Duration/
| parse @message "Init Duration: * ms" as initDuration
| stats avg(initDuration) as avgColdStart, count() as count
| sort avgColdStart desc
\`\`\`

**Full Observability Stack:**

\`\`\`mermaid
graph TD
    App[Application] -->|Structured logs| CWLogs[CloudWatch Logs]
    App -->|Custom metrics| CWMetrics[CloudWatch Metrics]
    EC2[EC2 / ECS] -->|Agent| CWLogs
    Lambda[Lambda] -->|Auto| CWLogs
    CWLogs -->|Metric Filter| CWMetrics
    CWMetrics --> Alarm[CloudWatch Alarm]
    Alarm -->|SNS| PagerDuty[PagerDuty / Email]
    Alarm -->|Auto Scaling| ASG[Auto Scaling Group]
    CWLogs --> Insights[Logs Insights\nAd-hoc analysis]
\`\`\`

**Embedded Metric Format — custom metrics from Lambda logs (zero extra API calls):**
\`\`\`javascript
import { createMetricsLogger, Unit } from 'aws-embedded-metrics';

export const handler = async (event) => {
  const metrics = createMetricsLogger();
  metrics.setNamespace('MyApp');
  metrics.putDimensions({ Service: 'OrderProcessor' });

  const start = Date.now();
  await processOrder(event);

  metrics.putMetric('OrderDuration', Date.now() - start, Unit.Milliseconds);
  metrics.putMetric('OrdersProcessed', 1, Unit.Count);
  await metrics.flush();  // Writes structured log → CloudWatch auto-extracts metric
};
\`\`\`

---

## 🔴 Advanced Level

**Composite Alarms — reduce alert noise:**
\`\`\`bash
# Only alarm if BOTH error rate is high AND latency is high
aws cloudwatch put-composite-alarm \
  --alarm-name "ServiceDegraded" \
  --alarm-rule "ALARM(HighErrorRate) AND ALARM(HighLatency)" \
  --alarm-actions arn:aws:sns:us-east-1:123:oncall-team
\`\`\`

**CloudWatch Agent config for EC2 (memory + disk metrics):**
\`\`\`json
{
  "metrics": {
    "metrics_collected": {
      "mem": { "measurement": ["mem_used_percent"] },
      "disk": { "measurement": ["disk_used_percent"], "resources": ["/"] }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [{
          "file_path": "/var/log/app/app.log",
          "log_group_name": "/myapp/production",
          "log_stream_name": "{instance_id}"
        }]
      }
    }
  }
}
\`\`\`

---

## ⚫ Pro / Expert Level

**Full SLO/SLI Monitoring Architecture:**

\`\`\`mermaid
graph TD
    Canary[CloudWatch Synthetics\nCanary every 5 min] --> API[Your API Endpoint]
    API --> APIGW[API Gateway\nMetrics: 4xx, 5xx, Latency]
    APIGW --> Lambda[Lambda\nMetrics: Errors, Duration, Throttles]
    Lambda --> DDB[DynamoDB\nMetrics: ConsumedCapacity, Throttles]

    APIGW -->|p99 latency > 500ms| Alarm1[SLO Alarm: Latency]
    APIGW -->|5xx rate > 0.1%| Alarm2[SLO Alarm: Error Rate]
    Alarm1 --> Composite[Composite SLO Alarm]
    Alarm2 --> Composite
    Composite --> EB[EventBridge] --> StepFn[Step Functions\nAuto-remediation]
\`\`\`

**Cross-account observability with CloudWatch Observability Access Manager:**
\`\`\`bash
# Link source account (prod) to monitoring account
aws oam create-link \
  --label-template '$AccountName' \
  --resource-types AWS::CloudWatch::Metric AWS::Logs::LogGroup \
  --sink-identifier arn:aws:oam:us-east-1:MONITORING-ACCOUNT:sink/xxx
\`\`\``
    },

    /* ═══════════════════════════════════════════════ 8. CloudFormation */
    {
        title: 'AWS CloudFormation – Infrastructure as Code',
        skillLevel: 'advanced',
        tldr: 'CloudFormation provisions and manages any AWS resource through declarative templates — the backbone of GitOps on AWS.',
        beginnerSummary: 'CloudFormation is like a recipe for your entire AWS infrastructure. Write what you want in a file and AWS builds it automatically — servers, databases, networks, everything.',
        proSummary: 'CloudFormation uses Stack Sets with service-managed deployment for AWS Organizations rollout. Custom Resources via Lambda handle non-native resources with CRUD lifecycle hooks. CloudFormation Hooks intercept resource operations for compliance. Dynamic References pull SSM Parameter Store values at deploy time. CDK synthesizes to CloudFormation but adds imperative logic and type safety.',
        whyMatters: 'Manual console-clicking infrastructure doesn\'t scale and is not repeatable. CloudFormation enables disaster recovery, environment parity, and auditability through version-controlled templates.',
        commonMistakes: 'No Change Sets before updates; not using DeletionPolicy:Retain for databases; YAML indentation errors; circular dependencies; hardcoded account IDs instead of !Sub ${AWS::AccountId}.',
        timeToPracticeMins: 90,
        nextTopicTitle: 'Amazon ECS',
        versionLabel: '2025',
        content: `## AWS CloudFormation – Infrastructure as Code

> 📚 [Official Docs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/)

---

## 🟢 Beginner Level

**Your First CloudFormation Template:**
\`\`\`yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: My first CloudFormation stack

Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-first-cfn-bucket-12345
      VersioningConfiguration:
        Status: Enabled
      Tags:
        - Key: Environment
          Value: Learning

Outputs:
  BucketName:
    Value: !Ref MyBucket
    Description: The S3 bucket name
  BucketArn:
    Value: !GetAtt MyBucket.Arn
\`\`\`

**Deploy:**
\`\`\`bash
aws cloudformation deploy \
  --template-file template.yaml \
  --stack-name my-first-stack
\`\`\`

---

## 🟡 Intermediate Level

**Parameters + Conditions + Mappings:**
\`\`\`yaml
Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
    Default: dev

Mappings:
  InstanceByEnv:
    dev:     { InstanceType: t3.micro }
    staging: { InstanceType: t3.small }
    prod:    { InstanceType: m5.large }

Conditions:
  IsProduction: !Equals [!Ref Environment, prod]

Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !FindInMap [InstanceByEnv, !Ref Environment, InstanceType]
      # Only create alarm in prod
  ProdAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: IsProduction
    Properties:
      AlarmName: prod-cpu-alarm
\`\`\`

**Stack lifecycle:**

\`\`\`mermaid
graph LR
    Template[Template File] -->|create-stack| Creating[Stack CREATING]
    Creating --> COMPLETE[Stack CREATE_COMPLETE]
    COMPLETE -->|change-set + execute| Updating[Stack UPDATING]
    Updating --> COMPLETE
    COMPLETE -->|delete-stack| Deleting[Stack DELETING]
    Creating -->|error| ROLLBACK[Stack ROLLBACK_COMPLETE]
\`\`\`

---

## 🔴 Advanced Level

**Nested Stacks for reusable modules:**
\`\`\`yaml
# root-stack.yaml
Resources:
  NetworkStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://s3.amazonaws.com/my-templates/network.yaml
      Parameters:
        VpcCidr: 10.0.0.0/16

  AppStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://s3.amazonaws.com/my-templates/app.yaml
      Parameters:
        VpcId: !GetAtt NetworkStack.Outputs.VpcId
        SubnetIds: !GetAtt NetworkStack.Outputs.SubnetIds
\`\`\`

**Dynamic references (no hardcoded secrets):**
\`\`\`yaml
Resources:
  RDSInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      # Pull secret from Secrets Manager at deploy time
      MasterUserPassword: '{{resolve:secretsmanager:prod/db:SecretString:password}}'
      # Pull value from SSM Parameter Store
      DBInstanceClass: '{{resolve:ssm:/myapp/prod/db-instance-type}}'
\`\`\`

---

## ⚫ Pro / Expert Level

**Multi-Account, Multi-Region StackSets:**

\`\`\`mermaid
graph TD
    Master[Management Account\nCloudFormation StackSet] -->|Deploy| Acc1[Dev Account\nus-east-1]
    Master -->|Deploy| Acc2[Dev Account\neu-west-1]
    Master -->|Deploy| Acc3[Prod Account\nus-east-1]
    Master -->|Deploy| Acc4[Prod Account\nap-southeast-1]
    style Master fill:#0066cc,color:#fff
\`\`\`

**CloudFormation + CodePipeline GitOps flow:**
\`\`\`yaml
# buildspec.yml (CodeBuild)
phases:
  install:
    commands:
      - pip install cfn-lint
  pre_build:
    commands:
      - cfn-lint template.yaml
      - aws cloudformation validate-template --template-body file://template.yaml
  build:
    commands:
      - aws cloudformation create-change-set \
          --stack-name prod-stack \
          --change-set-name deploy-$(date +%Y%m%d%H%M%S) \
          --template-body file://template.yaml \
          --capabilities CAPABILITY_IAM
\`\`\``
    },
]

/* ─── MAIN ───────────────────────────────────────────────────────────────── */
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
            versionLabel: p.versionLabel, authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        })
        if (errors?.length) console.error(`[${i + 1}/${posts.length}] FAIL: ${p.title}`, errors)
        else console.log(`[${i + 1}/${posts.length}] ✓ ${p.title} (${data.id})`)
        await new Promise(r => setTimeout(r, 400))
    }
    console.log('\nDone!')
}
main().catch(e => { console.error(e); process.exit(1) })
