// seed_batch1.mjs — Compute + Storage (EC2, Lambda, S3, EBS, EFS, FSx, Backup)
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch1.mjs
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

const posts = [
    // ═══ EC2 ═══════════════════════════════════════════════════════════════════
    {
        title: 'Amazon EC2 for Beginners – Launch Your First Virtual Server',
        skillLevel: 'beginner', timeToPracticeMins: 20,
        tldr: 'EC2 lets you rent a virtual computer in minutes. Choose Linux or Windows, pick a size, and pay only while it runs.',
        beginnerSummary: 'Think of EC2 as renting a computer from AWS. You choose the OS, size, and region — AWS handles the hardware.',
        proSummary: 'EC2 underpins most cloud workloads. Nitro hypervisor, instance families, placement groups, Spot interruption handling, and IMDSv2 all matter at scale.',
        whyMatters: 'EC2 is the foundation of cloud computing. Understanding it is step 1 for every AWS certification and real workload.',
        commonMistakes: 'Forgetting to stop instances when not in use. Using On-Demand for 24/7 workloads instead of Reserved.',
        nextTopicTitle: 'Auto Scaling', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🟢 Beginner Scenario: Host a Personal Website

> 📚 [AWS EC2 Docs](https://docs.aws.amazon.com/ec2/latest/userguide/)

**Scenario:** You want to host a personal blog on a server you control.

**What you need:** 1 EC2 instance + Security Group allowing port 80/443.

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[AWS Cloud]
  service igw(logos:aws-internet-gateway)[Internet Gateway] in aws
  service ec2(logos:aws-ec2)[EC2 t3.micro] in aws
  igw:R --> L:ec2
\`\`\`

**Steps:**
1. Go to EC2 → Launch Instance
2. Choose **Amazon Linux 2023**, select **t3.micro** (Free Tier)
3. Add Security Group rule: allow TCP 80 from 0.0.0.0/0
4. Launch → SSH in, install Apache:

\`\`\`bash
ssh -i mykey.pem ec2-user@<public-ip>
sudo yum install -y httpd && sudo systemctl start httpd
echo "<h1>Hello from EC2!</h1>" | sudo tee /var/www/html/index.html
\`\`\`

Visit your public IP in a browser — your site is live!

**Key Concepts:**
- **AMI** = pre-built OS image (Amazon Linux, Ubuntu, Windows)
- **Instance Type** = hardware size (t3.micro = 2 vCPU, 1 GB RAM)
- **Security Group** = firewall rules for your instance
- **Key Pair** = SSH login credentials (download once, keep safe)`
    },
    {
        title: 'Amazon EC2 Intermediate – Auto Scaling & Load Balancing',
        skillLevel: 'intermediate', timeToPracticeMins: 45,
        tldr: 'Combine EC2 Auto Scaling with an Application Load Balancer to handle traffic spikes automatically.',
        beginnerSummary: 'If your website gets suddenly popular, Auto Scaling adds more EC2 servers automatically, and the Load Balancer spreads traffic across them.',
        proSummary: 'ASG lifecycle hooks, warm pools, target tracking policies vs. step scaling, and ELB connection draining are critical for zero-downtime deployments.',
        whyMatters: 'Manual scaling leads to downtime or overspending. ASG+ALB makes your app resilient and cost-effective automatically.',
        commonMistakes: 'Not setting a warm-up period on scaling policies. Forgetting Health Check grace period causing rapid instance termination.',
        nextTopicTitle: 'EC2 Advanced', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🟡 Intermediate Scenario: E-Commerce App Surviving a Flash Sale

> 📚 [ASG Docs](https://docs.aws.amazon.com/autoscaling/ec2/userguide/) | [ALB Docs](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)

**Scenario:** Your online store has 100 normal users/day but 10,000 during a sale. You need to scale up automatically and scale back down to save money.

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[AWS – us-east-1]
  service users(logos:aws-general)[10k Users] in aws
  service alb(logos:aws-elb)[App Load Balancer] in aws
  service asg(logos:aws-auto-scaling)[Auto Scaling Group] in aws
  service ec2a(logos:aws-ec2)[EC2-AZ-a] in aws
  service ec2b(logos:aws-ec2)[EC2-AZ-b] in aws
  service cw(logos:aws-cloudwatch)[CloudWatch Alarm] in aws
  users:R --> L:alb
  alb:R --> L:ec2a
  alb:R --> L:ec2b
  cw:B --> T:asg
  asg:R --> L:ec2a
  asg:R --> L:ec2b
\`\`\`

**Configuration Highlights:**

**1. Launch Template:**
\`\`\`bash
aws ec2 create-launch-template \\
  --launch-template-name web-lt \\
  --version-description v1 \\
  --launch-template-data '{
    "ImageId": "ami-0abc123",
    "InstanceType": "t3.small",
    "UserData": "<base64 bootstrap script>"
  }'
\`\`\`

**2. Target Tracking Policy (scale when CPU > 60%):**
\`\`\`bash
aws autoscaling put-scaling-policy \\
  --auto-scaling-group-name my-asg \\
  --policy-name TargetCPU60 \\
  --policy-type TargetTrackingScaling \\
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 60.0
  }'
\`\`\`

**Instance Pricing Cheat Sheet:**
| Purchase Model | Savings | Best For |
|---|---|---|
| On-Demand | 0% | Dev/Test |
| Reserved 1yr | ~40% | Steady workloads |
| Spot | ~90% | Batch jobs |`
    },
    {
        title: 'Amazon EC2 Advanced – Placement Groups, Spot Fleet & IMDSv2',
        skillLevel: 'advanced', timeToPracticeMins: 90,
        tldr: 'Master EC2 Placement Groups for HPC, Spot Fleet for 90% cost savings, and IMDSv2 for secure metadata access.',
        beginnerSummary: 'Advanced EC2 lets you fine-tune WHERE instances run (placement groups), HOW you pay (Spot Fleet), and HOW securely metadata is accessed (IMDSv2).',
        proSummary: 'Cluster Placement Groups need Jumbo Frames MTU 9001. Spot Fleet diversification prevents single-pool exhaustion. IMDSv2 mitigates SSRF-based credential theft.',
        whyMatters: 'These features separate cost-efficient, secure, high-performance architectures from basic cloud deployments.',
        commonMistakes: 'Not enabling IMDSv2 (leaving metadata endpoint open to SSRF). Using Cluster placement group across AZs (not supported). Forgetting interruption handlers for Spot.',
        nextTopicTitle: 'EC2 Pro', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🔴 Advanced Scenario: HPC Genomics Cluster + Spot Fleet

> 📚 [Placement Groups](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/placement-groups.html) | [Spot Fleet](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-fleet.html) | [IMDSv2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)

**Scenario:** A biotech startup runs genome sequencing jobs that need ultra-low latency between nodes (HPC), must be fault-tolerant, and must stay under budget using Spot.

\`\`\`mermaid
architecture-beta
  group hw(logos:aws)[HPC Cluster – us-east-1a]
  service pg(logos:aws-ec2)[Cluster Placement Group] in hw
  service m1(logos:aws-ec2)[c6i.32xlarge #1] in hw
  service m2(logos:aws-ec2)[c6i.32xlarge #2] in hw
  service m3(logos:aws-ec2)[c6i.32xlarge #3] in hw
  service efs(logos:aws-efs)[Shared EFS Storage] in hw
  service eb(logos:aws-eventbridge)[EventBridge – Spot Interrupt] in hw
  service lam(logos:aws-lambda)[Lambda – Checkpoint] in hw
  pg:R --> L:m1
  pg:R --> L:m2
  pg:R --> L:m3
  m1:B --> T:efs
  eb:R --> L:lam
\`\`\`

**Placement Groups:**
| Type | Use Case | Max per AZ |
|---|---|---|
| Cluster | HPC, low latency | No limit |
| Spread | Max availability | 7 per AZ |
| Partition | Hadoop, Kafka | 7 partitions |

**Spot Fleet with Diversification:**
\`\`\`json
{
  "SpotFleetRequestConfig": {
    "AllocationStrategy": "diversified",
    "TargetCapacity": 100,
    "LaunchSpecifications": [
      {"InstanceType": "c6i.4xlarge", "SubnetId": "subnet-az1"},
      {"InstanceType": "c5.4xlarge",  "SubnetId": "subnet-az2"},
      {"InstanceType": "c6a.4xlarge", "SubnetId": "subnet-az3"}
    ]
  }
}
\`\`\`

**IMDSv2 (Mandatory Token-Based Access):**
\`\`\`bash
# Require IMDSv2 on new instances (prevent SSRF attacks)
aws ec2 modify-instance-metadata-options \\
  --instance-id i-xxx \\
  --http-tokens required \\
  --http-endpoint enabled

# Fetch metadata securely
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" \\
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -H "X-aws-ec2-metadata-token: $TOKEN" \\
  http://169.254.169.254/latest/meta-data/instance-id
\`\`\``
    },
    {
        title: 'Amazon EC2 Expert – Graviton, CapacityBlocks & Nitro Enclaves',
        skillLevel: 'pro', timeToPracticeMins: 120,
        tldr: 'At expert level, EC2 means Graviton3 cost efficiency, ML CapacityBlocks, and Nitro Enclave confidential computing.',
        beginnerSummary: 'The pro EC2 world involves specialized hardware for AI/ML (P5 instances), ARM-based chips that cost 40% less (Graviton), and secure enclaves for sensitive data processing.',
        proSummary: 'Graviton3 uses 60% less energy vs x86. P5.48xlarge provides 8× H100 GPUs via EFA at 3.2 Tbps bandwidth. Nitro Enclaves provide cryptographic attestation using PCR values for HIPAA/PCI workloads.',
        whyMatters: 'Expert-level EC2 decisions save 30-60% on compute bills and enable workloads (ML training, confidential computing) not possible on general hardware.',
        commonMistakes: 'Choosing Graviton without testing application compatibility first. Running GPU instances idle between training jobs (use CapacityBlocks or SageMaker).',
        nextTopicTitle: 'AWS Lambda', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## ⚫ Expert Scenario: Multi-Modal AI Training Pipeline

> 📚 [Graviton](https://aws.amazon.com/ec2/graviton/) | [CapacityBlocks](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-capacity-blocks.html) | [Nitro Enclaves](https://docs.aws.amazon.com/enclaves/latest/user/nitro-enclaves-user-guide.html)

**Scenario:** An AI company trains large language models on GPU clusters, runs inference on Graviton, and processes patient medical data in Nitro Enclaves for HIPAA compliance.

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[Enterprise AI Platform]
  service cb(logos:aws-ec2)[CapacityBlock p5.48xlarge ×8] in aws
  service grav(logos:aws-ec2)[Graviton3 c7g Inference Fleet] in aws
  service s3(logos:aws-s3)[S3 Model Artifacts] in aws
  service enclave(logos:aws-ec2)[Nitro Enclave – PHI Processing] in aws
  service kms(logos:aws-kms)[KMS Key Attestation] in aws
  service alb(logos:aws-elb)[Internal ALB] in aws
  cb:R --> L:s3
  s3:R --> L:grav
  alb:R --> L:enclave
  enclave:B --> T:kms
\`\`\`

**Graviton ROI Calculation:**
\`\`\`text
m6i.4xlarge  (Intel)  = $0.768/hr
m7g.4xlarge  (Graviton3) = $0.6528/hr  → 15% cheaper + 40% better perf/watt
For 1000 instance-hours/month: saves $115/month
At scale (10,000 instances): saves $1,150/month or ~$14k/year
\`\`\`

**CapacityBlocks for ML (Reserve GPU time):**
\`\`\`bash
# View available GPU capacity blocks (e.g., 8× p5.48xlarge for 1 week)
aws ec2 describe-capacity-block-offerings \\
  --instance-type p5.48xlarge \\
  --capacity-duration-hours 168 \\
  --region us-east-1

# Purchase capacity block
aws ec2 purchase-capacity-block \\
  --capacity-block-offering-id cbr-xxx \\
  --instance-platform Linux/UNIX
\`\`\`

**Nitro Enclave – Confidential PHI Processing:**
\`\`\`bash
# Build enclave image
nitro-cli build-enclave \\
  --docker-uri 123456789.dkr.ecr.us-east-1.amazonaws.com/phi-processor:latest \\
  --output-file phi-processor.eif

# Run enclave with KMS attestation policy
nitro-cli run-enclave \\
  --eif-path phi-processor.eif \\
  --cpu-count 2 \\
  --memory 4096

# KMS key policy validates PCR values (cryptographic proof of enclave identity)
\`\`\``
    },
    // ═══ S3 ══════════════════════════════════════════════════════════════════
    {
        title: 'Amazon S3 for Beginners – Store and Share Files in the Cloud',
        skillLevel: 'beginner', timeToPracticeMins: 15,
        tldr: 'S3 stores any file in "buckets" — think of it as Google Drive for developers, but infinitely scalable.',
        beginnerSummary: 'S3 is AWS\'s file storage. Upload photos, videos, documents — access them from anywhere. AWS guarantees your files are never lost.',
        proSummary: 'S3 uses consistent hashing across 3+ AZs with 11 nines durability. Event-driven with EventBridge, multipart upload for >5GB, S3 Select for SQL queries on objects.',
        whyMatters: 'S3 is the most used AWS service. It underpins static websites, data lakes, backups, and inter-service data exchange.',
        commonMistakes: 'Leaving buckets public accidentally. Not enabling versioning. Storing millions of tiny files without batching.',
        nextTopicTitle: 'S3 Storage Classes', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🟢 Beginner Scenario: Share Product Images for an Online Store

> 📚 [S3 Getting Started](https://docs.aws.amazon.com/AmazonS3/latest/userguide/GetStartedWithS3.html)

**Scenario:** You run a small shop and want to store product images so your website can display them to customers.

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[AWS]
  service s3(logos:aws-s3)[S3 Bucket\nproduct-images] in aws
  service cf(logos:aws-cloudfront)[CloudFront CDN] in aws
  service customer(logos:aws-general)[Customers Worldwide] in aws
  s3:R --> L:cf
  cf:R --> L:customer
\`\`\`

**Steps:**
\`\`\`bash
# Create bucket
aws s3 mb s3://myshop-product-images-2025

# Upload an image
aws s3 cp ./product1.jpg s3://myshop-product-images-2025/products/product1.jpg

# Make item publicly readable (for website display)
aws s3api put-object-acl \\
  --bucket myshop-product-images-2025 \\
  --key products/product1.jpg \\
  --acl public-read

# Your image URL:
# https://myshop-product-images-2025.s3.amazonaws.com/products/product1.jpg
\`\`\`

**Key Terms:**
- **Bucket** = The container (like a folder root). Name is globally unique.
- **Object** = The file + its metadata. Max 5 TB each.
- **Key** = The file path inside the bucket (e.g., \`products/product1.jpg\`)
- **ACL** = Who can access it (public or private)
- **Endpoint** = The URL to access your object`
    },
    {
        title: 'Amazon S3 Intermediate – Storage Classes, Lifecycle & Versioning',
        skillLevel: 'intermediate', timeToPracticeMins: 30,
        tldr: 'S3 has 7 storage classes. Lifecycle policies automatically move data to cheaper tiers. Versioning prevents accidental deletes.',
        beginnerSummary: 'S3 offers multiple pricing tiers. You can automatically move files to cheaper storage as they get older. Versioning keeps all past versions of a file.',
        proSummary: 'Intelligent-Tiering archive tier uses DynamoDB-backed access metrics. Glacier Instant Retrieval has 90-day min charge. Multipart upload aborts need lifecycle rule to avoid orphan parts.',
        whyMatters: 'Proper storage class selection can reduce S3 costs by 60-85% for infrequently accessed data like logs and archives.',
        commonMistakes: 'Not aborting incomplete multipart uploads (they incur storage charges). Using Standard for data accessed < once/month.',
        nextTopicTitle: 'S3 Advanced', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🟡 Intermediate Scenario: Company Log Retention Policy

> 📚 [S3 Storage Classes](https://aws.amazon.com/s3/storage-classes/) | [Lifecycle Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)

**Scenario:** Your company generates 500 GB of logs per day. Policy requires 90 days fast access, 1 year slow access, 7-year archive.

**Storage Classes Cost Comparison:**
| Class | Use Case | Min Duration | $/GB/month |
|---|---|---|---|
| Standard | Frequently accessed | None | $0.023 |
| Standard-IA | Monthly access | 30 days | $0.0125 |
| Glacier Instant | Quarterly access | 90 days | $0.004 |
| Glacier Flexible | Annual access | 90 days | $0.0036 |
| Deep Archive | 7+ year retention | 180 days | $0.00099 |

**Lifecycle Policy (auto-transition logs):**
\`\`\`json
{
  "Rules": [{
    "Id": "log-retention",
    "Status": "Enabled",
    "Filter": { "Prefix": "logs/" },
    "Transitions": [
      { "Days": 90,  "StorageClass": "STANDARD_IA" },
      { "Days": 365, "StorageClass": "GLACIER" }
    ],
    "Expiration": { "Days": 2555 }
  }, {
    "Id": "abort-multipart",
    "Status": "Enabled",
    "Filter": {},
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
  }]
}
\`\`\`

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[Log Lifecycle]
  service app(logos:aws-ec2)[Application Servers] in aws
  service s3std(logos:aws-s3)[S3 Standard\n0-90 days] in aws
  service s3ia(logos:aws-s3)[S3 Standard-IA\n90-365 days] in aws
  service glacier(logos:aws-s3)[Glacier\n1-7 years] in aws
  service exp(logos:aws-s3)[Auto-Delete\nDay 2555] in aws
  app:R --> L:s3std
  s3std:R --> L:s3ia
  s3ia:R --> L:glacier
  glacier:R --> L:exp
\`\`\``
    },
    {
        title: 'Amazon S3 Advanced – Replication, Object Lock & Event-Driven Pipelines',
        skillLevel: 'advanced', timeToPracticeMins: 60,
        tldr: 'Advanced S3 uses CRR for disaster recovery, Object Lock for compliance, and event notifications for real-time processing pipelines.',
        beginnerSummary: 'Advanced S3 can copy your data to another region automatically for disaster recovery, lock files so they can\'t be deleted (for compliance), and trigger processing when files are uploaded.',
        proSummary: 'CRR requires versioning and appropriate IAM role with replication permissions. Object Lock governance mode can still be overridden by admin. Event-driven with EventBridge gives 18+ targets vs 4 with S3 notifications.',
        whyMatters: 'These features make S3 suitable for regulatory compliance (FINRA, HIPAA, SEC), business continuity, and real-time data processing at scale.',
        commonMistakes: 'Not setting replication for existing objects (CRR only applies to new objects by default). Using governance mode thinking no one can override it.',
        nextTopicTitle: 'S3 Expert', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🔴 Advanced Scenario: Financial Records Compliance Platform

> 📚 [S3 Replication](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html) | [Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) | [Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html)

**Scenario:** A bank must store trade records for 7 years with immutability (SEC Rule 17a-4), replicate to a DR region, and trigger real-time processing on upload.

\`\`\`mermaid
architecture-beta
  group primary(logos:aws)[Primary Region – us-east-1]
  group dr(logos:aws)[DR Region – us-west-2]
  service app(logos:aws-ec2)[Trading App] in primary
  service s3p(logos:aws-s3)[S3 + Object Lock\nCOMPLIANCE mode] in primary
  service s3dr(logos:aws-s3)[S3 Replica\n+Object Lock] in dr
  service eb(logos:aws-eventbridge)[EventBridge] in primary
  service lam(logos:aws-lambda)[Lambda\nProcess Trade] in primary
  service ddb(logos:aws-dynamodb)[DynamoDB\nTrade Index] in primary
  app:R --> L:s3p
  s3p:R --> L:s3dr
  s3p:B --> T:eb
  eb:R --> L:lam
  lam:R --> L:ddb
\`\`\`

**Object Lock — COMPLIANCE mode (7-year hold):**
\`\`\`bash
# Enable at bucket creation (cannot be disabled later!)
aws s3api create-bucket --bucket trade-records-prod-2025 \\
  --object-lock-enabled-for-bucket --region us-east-1

# Apply 7-year retention
aws s3api put-object-retention \\
  --bucket trade-records-prod-2025 \\
  --key "2025/02/25/trade-10291.json" \\
  --retention '{
    "Mode": "COMPLIANCE",
    "RetainUntilDate": "2032-02-25T00:00:00Z"
  }'
\`\`\`

**Cross-Region Replication setup:**
\`\`\`bash
aws s3api put-bucket-replication \\
  --bucket trade-records-prod-2025 \\
  --replication-configuration '{
    "Role": "arn:aws:iam::123:role/replication-role",
    "Rules": [{"Status": "Enabled",
      "Destination": {
        "Bucket": "arn:aws:s3:::trade-records-dr-2025",
        "ReplicaModifications": {"Status": "Enabled"},
        "ReplicationTime": {"Status": "Enabled", "Time": {"Minutes": 15}}
      }
    }]
  }'
\`\`\``
    },
    {
        title: 'Amazon S3 Expert – Data Lake, Athena Optimization & S3 Select',
        skillLevel: 'pro', timeToPracticeMins: 120,
        tldr: 'Expert S3 powers petabyte-scale data lakes using partitioned Parquet, Athena SQL, S3 Select for in-place analytics, and Table Buckets.',
        beginnerSummary: 'At the expert level, S3 is the foundation of your entire analytics platform — data flows in, gets organized into columns, and you query it directly with SQL without loading it into a database.',
        proSummary: 'Partition projection in Athena eliminates MSCK REPAIR TABLE cost. S3 Select reduces data scanned by 99% for column filtering. S3 Tables (Table Buckets) bring native Iceberg management. Use S3 Inventory for large-bucket audits instead of LIST calls.',
        whyMatters: 'A well-designed S3 data lake can replace a $50k/month Redshift cluster for many analytical workloads at a fraction of the cost.',
        commonMistakes: 'Not partitioning data (full scans cost 100× more in Athena). Using CSV instead of Parquet (5-10× more expensive per query). Not enabling S3 request metrics for cost visibility.',
        nextTopicTitle: 'Amazon EBS', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## ⚫ Expert Scenario: Real-Time Analytics Data Lake

> 📚 [S3 Data Lake](https://aws.amazon.com/big-data/datalakes-and-analytics/) | [Athena Best Practices](https://docs.aws.amazon.com/athena/latest/ug/other-notable-limitations.html) | [S3 Select](https://docs.aws.amazon.com/AmazonS3/latest/userguide/selecting-content-from-objects.html)

**Scenario:** An analytics company processes 10 TB/day of clickstream data. Analysts run SQL queries. CFO demands minimum Athena costs.

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[Data Lake Architecture]
  service kinesis(logos:aws-kinesis)[Kinesis Data Streams] in aws
  service firehose(logos:aws-kinesis)[Kinesis Firehose\n→ Parquet] in aws
  service s3raw(logos:aws-s3)[S3 Raw Zone] in aws
  service glue(logos:aws-glue)[Glue ETL\nPartition + Convert] in aws
  service s3proc(logos:aws-s3)[S3 Processed Zone\nParquet, Partitioned] in aws
  service athena(logos:aws-athena)[Athena SQL Queries] in aws
  service qs(logos:aws-quicksight)[QuickSight\nDashboards] in aws
  kinesis:R --> L:firehose
  firehose:R --> L:s3raw
  s3raw:R --> L:glue
  glue:R --> L:s3proc
  s3proc:R --> L:athena
  athena:R --> L:qs
\`\`\`

**Partition Strategy (saves 95% on Athena queries):**
\`\`\`
s3://analytics-lake/events/
  year=2025/month=02/day=25/hour=14/
    part-001.parquet  (128 MB blocks)
    part-002.parquet
\`\`\`

**Athena Partition Projection (no MSCK REPAIR needed):**
\`\`\`sql
CREATE EXTERNAL TABLE events (
  user_id STRING, event_type STRING, value DOUBLE
)
PARTITIONED BY (year STRING, month STRING, day STRING, hour STRING)
STORED AS PARQUET
LOCATION 's3://analytics-lake/events/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.year.type' = 'integer', 'projection.year.range' = '2024,2026',
  'projection.month.type' = 'integer', 'projection.month.range' = '01,12',
  'projection.day.type' = 'integer', 'projection.day.range' = '01,31',
  'projection.hour.type' = 'integer', 'projection.hour.range' = '00,23'
);
\`\`\`

**S3 Select — Query inside an object (99% less data scanned):**
\`\`\`python
import boto3
s3 = boto3.client('s3')
result = s3.select_object_content(
    Bucket='analytics-lake', Key='events/year=2025/month=02/day=25/part-001.parquet',
    ExpressionType='SQL',
    Expression="SELECT user_id, event_type FROM S3Object WHERE value > 100",
    InputSerialization={'Parquet': {}},
    OutputSerialization={'JSON': {}}
)
for event in result['Payload']:
    if 'Records' in event:
        print(event['Records']['Payload'].decode())
\`\`\``
    },
    // ═══ AWS LAMBDA ═══════════════════════════════════════════════════════════
    {
        title: 'AWS Lambda for Beginners – Run Code Without Servers',
        skillLevel: 'beginner', timeToPracticeMins: 20,
        tldr: 'Lambda runs your code in response to events — no server setup, no patching. Pay only per millisecond of execution.',
        beginnerSummary: 'Lambda is like a vending machine for code. Drop in your function, tell it what triggers it, and Lambda runs it automatically — scaling from 0 to thousands instantly.',
        proSummary: 'Lambda execution environment: Init→Invoke→Shutdown. SnapStart for Java 21 snapshots post-init state. Function URL provides direct HTTPS endpoint. Extensions API provides observability sidecars.',
        whyMatters: 'Lambda eliminates server management for event-driven workloads. Combined with API Gateway, DynamoDB, and S3, it enables serverless apps with zero operational overhead.',
        commonMistakes: 'Oversized deployment packages slow cold starts. Not setting DLQ on async invocations loses failed events. Timeout too short for downstream latency.',
        nextTopicTitle: 'Lambda Intermediate', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🟢 Beginner Scenario: Automatically Resize Images on Upload

> 📚 [Lambda Getting Started](https://docs.aws.amazon.com/lambda/latest/dg/getting-started.html)

**Scenario:** When a user uploads a photo to your app's S3 bucket, automatically create a thumbnail version.

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[AWS Serverless]
  service user(logos:aws-general)[User uploads photo] in aws
  service s3in(logos:aws-s3)[S3 – Original Images] in aws
  service lam(logos:aws-lambda)[Lambda – Thumbnail Creator] in aws
  service s3out(logos:aws-s3)[S3 – Thumbnails] in aws
  user:R --> L:s3in
  s3in:R --> L:lam
  lam:R --> L:s3out
\`\`\`

**Your First Lambda (Node.js):**
\`\`\`javascript
// index.mjs
export const handler = async (event) => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name
    const key    = record.s3.object.key
    console.log(\`Processing: s3://\${bucket}/\${key}\`)
    // Call your image resize library here
  }
  return { status: 'done' }
}
\`\`\`

**Deploy it:**
\`\`\`bash
zip function.zip index.mjs
aws lambda create-function \\
  --function-name thumbnail-creator \\
  --runtime nodejs20.x \\
  --handler index.handler \\
  --zip-file fileb://function.zip \\
  --role arn:aws:iam::123456789:role/lambda-s3-role

# Trigger: add S3 notification for bucket events
aws s3api put-bucket-notification-configuration \\
  --bucket my-uploads-bucket \\
  --notification-configuration '{
    "LambdaFunctionConfigurations": [{
      "LambdaFunctionArn": "arn:aws:lambda:us-east-1:123:function:thumbnail-creator",
      "Events": ["s3:ObjectCreated:*"]
    }]
  }'
\`\`\``
    },
    {
        title: 'AWS Lambda Intermediate – Event Sources, Layers & Concurrency',
        skillLevel: 'intermediate', timeToPracticeMins: 45,
        tldr: 'Lambda integrates with 200+ AWS services as event sources. Layers share code across functions. Concurrency limits prevent cost explosions.',
        beginnerSummary: 'Lambda can be triggered by nearly any AWS service. You can share common libraries as Layers. Concurrency controls prevent one function from taking all capacity.',
        proSummary: 'Event Source Mapping (ESM) for SQS/Kinesis uses checkpoint-based processing. Provisioned Concurrency pre-warms environments. Reserved Concurrency = hard cap for blast radius.',
        whyMatters: 'Production Lambda requires understanding invocation types, concurrency quotas, and how to share dependencies efficiently to avoid cold-start penalties.',
        commonMistakes: 'Not using partial batch failure mode with SQS ESM. Bundling large SDKs instead of using Lambda Layers. Not setting reserved concurrency on critical functions.',
        nextTopicTitle: 'Lambda Advanced', versionLabel: '2025', authorSub: 'seed-admin', authorName: 'Cloud Journey Team',
        content: `## 🟡 Intermediate Scenario: Serverless Order Processing API

> 📚 [Lambda Event Sources](https://docs.aws.amazon.com/lambda/latest/dg/lambda-services.html) | [Lambda Layers](https://docs.aws.amazon.com/lambda/latest/dg/chapter-layers.html) | [Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)

**Scenario:** E-commerce platform needs order processing: HTTP API → Lambda → SQS → Lambda → DynamoDB.

\`\`\`mermaid
architecture-beta
  group aws(logos:aws)[Serverless Order System]
  service apigw(logos:aws-api-gateway)[API Gateway\nHTTP API] in aws
  service lamapi(logos:aws-lambda)[Lambda – Order API\n(Sync)] in aws
  service sqs(logos:aws-sqs)[SQS FIFO Queue] in aws
  service lamproc(logos:aws-lambda)[Lambda – Order Processor\n(Async ESM)] in aws
  service ddb(logos:aws-dynamodb)[DynamoDB Orders] in aws
  service dlq(logos:aws-sqs)[DLQ – Failed Orders] in aws
  apigw:R --> L:lamapi
  lamapi:R --> L:sqs
  sqs:R --> L:lamproc
  lamproc:R --> L:ddb
  lamproc:B --> T:dlq
\`\`\`

**Invocation Types:**
| Type | Source | Error Handling |
|---|---|---|
| Synchronous | API Gateway, ALB | Caller gets the error |
| Asynchronous | S3, SNS, EventBridge | Retry 2× → DLQ |
| Event Source Mapping | SQS, Kinesis, DynamoDB Stream | Retry until expired |

**Lambda Layer for shared SDK:**
\`\`\`bash
# Create layer with shared dependencies
mkdir nodejs && cd nodejs
npm install @aws-sdk/client-dynamodb
cd .. && zip -r layer.zip nodejs/

aws lambda publish-layer-version \\
  --layer-name aws-sdk-v3-layer \\
  --zip-file fileb://layer.zip \\
  --compatible-runtimes nodejs20.x
\`\`\`

**SQS with Partial Batch Failure:**
\`\`\`javascript
export const handler = async (event) => {
  const failures = []
  for (const record of event.Records) {
    try {
      await processOrder(JSON.parse(record.body))
    } catch (e) {
      failures.push({ itemIdentifier: record.messageId })
    }
  }
  return { batchItemFailures: failures } // Only failed messages retry
}
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
