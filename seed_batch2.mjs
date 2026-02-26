// seed_batch2.mjs — Lambda Advanced/Pro + EBS + EFS + FSx + Backup
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch2.mjs
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
    // ═══ LAMBDA ADVANCED ══════════════════════════════════════════════════════
    {
        title: 'AWS Lambda Advanced – SnapStart, Cold Starts & Function URLs',
        skillLevel: 'advanced', timeToPracticeMins: 60,
        tldr: 'Eliminate Java cold starts with SnapStart, use Function URLs for lightweight HTTPS endpoints, and tune memory/timeout for peak performance.',
        beginnerSummary: 'Advanced Lambda is about making your functions start faster, run cheaper, and connect directly to the internet without API Gateway.',
        proSummary: 'SnapStart snapshots JVM post-init and restores per-invocation. Function URLs support IAM or NONE auth with CORS config. ARM64/Graviton2 saves 20% on Lambda costs with same performance.',
        whyMatters: 'Cold start latency kills user experience for Java/Python. SnapStart brings Java 21 cold starts from 8s → 200ms. Function URLs eliminate API Gateway costs for simple endpoints.',
        commonMistakes: 'Not implementing Restore hooks (CRaC) for SnapStart — random number generators and TLS sessions need refresh. Using Function URLs without IAM for sensitive endpoints.',
        nextTopicTitle: 'Lambda Pro', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## 🔴 Advanced: Lambda Performance Engineering

> 📚 [SnapStart](https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html) | [Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html) | [ARM64](https://docs.aws.amazon.com/lambda/latest/dg/foundation-arch.html)

### Cold Start Comparison

| Runtime | Typical Cold Start | With SnapStart |
|---|---|---|
| Python 3.12 | 200-400ms | N/A |
| Node.js 20 | 100-300ms | N/A |
| Java 21 | 5-10s | 150-200ms ✅ |
| .NET 8 | 1-3s | 200-400ms ✅ |

### Enable SnapStart (Java 21)

\`\`\`bash
aws lambda update-function-configuration \\
  --function-name my-java-api \\
  --snap-start ApplyOn=PublishedVersions \\
  --runtime java21

# Publish a version to activate SnapStart
aws lambda publish-version --function-name my-java-api
\`\`\`

### CRaC Restore Hook (required for correctness)

\`\`\`java
import org.crac.*;

public class Handler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse>, Resource {

    private static SSLContext sslContext;

    static {
        Core.getGlobalContext().register(new Handler());
        sslContext = SSLContext.getDefault(); // initialized at snapshot time
    }

    @Override
    public void afterRestore(Context<? extends Resource> context) {
        // Refresh anything time-sensitive after snapshot restore
        sslContext = SSLContext.getDefault();
        Random.reseed(); // if using SecureRandom
    }
}
\`\`\`

### Function URL (direct HTTPS endpoint, no API Gateway)

\`\`\`bash
aws lambda create-function-url-config \\
  --function-name my-webhook \\
  --auth-type NONE \\
  --cors '{
    "AllowOrigins": ["https://yourdomain.com"],
    "AllowMethods": ["POST"],
    "AllowHeaders": ["content-type"]
  }'
# Returns: https://abc123.lambda-url.us-east-1.on.aws/
\`\`\`

### ARM64 (Graviton2) – 20% cheaper, same performance

\`\`\`bash
aws lambda update-function-configuration \\
  --function-name my-function \\
  --architectures arm64
\`\`\`

### Memory vs Cost Optimization

\`\`\`text
128 MB  → $0.0000000021/ms  (cheap but slow)
512 MB  → $0.0000000083/ms  (often sweet spot)
3008 MB → $0.0000000479/ms  (fastest, most expensive)

Tip: Use AWS Lambda Power Tuning tool to find optimal memory
\`\`\`

\`\`\`mermaid
flowchart LR
    A[Java Request] --> B{SnapStart enabled?}
    B -->|Yes| C[Restore Snapshot 150ms]
    B -->|No| D[Full JVM Init 8s]
    C --> E[Handler Runs]
    D --> E
    E --> F[Response]
\`\`\``
    },
    // ═══ LAMBDA PRO ═══════════════════════════════════════════════════════════
    {
        title: 'AWS Lambda Pro – Extensions, Destinations & Cost Optimization at Scale',
        skillLevel: 'pro', timeToPracticeMins: 90,
        tldr: 'At expert level: Lambda Extensions for observability sidecars, async Destinations for post-processing, and Compute Optimizer for right-sizing thousands of functions.',
        beginnerSummary: 'Pro Lambda is about operating Lambda at org scale: monitoring every function, routing success/failure events automatically, and cutting compute bills.',
        proSummary: 'Extensions API runs sidecar processes in the same execution environment. Destinations replace DLQ for async flows with richer metadata. Lambda Graviton + Compute Optimizer can cut function costs 30-50% fleet-wide.',
        whyMatters: 'At 1M+ invocations/day, Lambda cost and observability become engineering priorities. Extensions provide APM without code changes. Destinations enable fanout without polling.',
        commonMistakes: 'Forgetting that Extensions add to cold start time. Not using Destinations for async invocations (DLQ only gets the payload, not context). Ignoring Compute Optimizer recommendations.',
        nextTopicTitle: 'Amazon EBS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## ⚫ Pro: Lambda at Organizational Scale

> 📚 [Lambda Extensions](https://docs.aws.amazon.com/lambda/latest/dg/lambda-extensions.html) | [Destinations](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations) | [Compute Optimizer](https://docs.aws.amazon.com/compute-optimizer/latest/ug/lambda-recommendations.html)

### Lambda Extensions (Observability Sidecar)

Extensions run as separate processes alongside your function — inject APM, secrets, or log shippers without touching function code.

\`\`\`bash
# Deploy Datadog extension as a layer (no code change needed)
aws lambda update-function-configuration \\
  --function-name my-api \\
  --layers arn:aws:lambda:us-east-1:464622532012:layer:Datadog-Extension:51 \\
  --environment Variables='{
    "DD_API_KEY": "xxx",
    "DD_SITE": "datadoghq.com",
    "DD_FLUSH_TO_LOG": "false"
  }'
\`\`\`

### Async Destinations (replace DLQ)

\`\`\`bash
# Route success → SQS, failure → SNS
aws lambda put-function-event-invoke-config \\
  --function-name order-processor \\
  --maximum-retry-attempts 2 \\
  --destination-config '{
    "OnSuccess": {
      "Destination": "arn:aws:sqs:us-east-1:123:order-success-queue"
    },
    "OnFailure": {
      "Destination": "arn:aws:sns:us-east-1:123:order-failure-alert"
    }
  }'
\`\`\`

Destinations send enriched payloads including: requestId, condition (Success/Failure), approximateInvokeCount, and the original request + response.

### Fleet-Wide Cost Analysis

\`\`\`python
import boto3
co = boto3.client('compute-optimizer')
recs = co.get_lambda_function_recommendations(
    filters=[{'name': 'Finding', 'values': ['Overprovisioned']}]
)
for r in recs['lambdaFunctionRecommendations']:
    print(f"{r['functionArn']}: save {r['currentCostMonthly'] - r['estimatedMonthlySavings']['value']:.2f}/mo")
\`\`\`

### Lambda Architecture: Event-Driven Fanout

\`\`\`mermaid
flowchart LR
    EB[EventBridge Rule] --> L1[Lambda Order\nProcessor]
    L1 -->|OnSuccess| SQS[SQS Success Queue]
    L1 -->|OnFailure| SNS[SNS Alert Topic]
    SQS --> L2[Lambda Fulfillment]
    SNS --> OPS[Ops Team Email]
    L1 -.sidecar.- EXT[DD Extension\nTraces + Metrics]
\`\`\`

### Reserved vs Provisioned Concurrency Decision Tree

\`\`\`mermaid
flowchart TD
    A[Function needs low latency?] -->|Yes| B[Predictable traffic?]
    A -->|No| F[No special concurrency needed]
    B -->|Yes| C[Provisioned Concurrency\nPre-warm N environments]
    B -->|No| D[SnapStart for Java/DotNet\nor optimize runtime]
    C --> E[Set reserved concurrency\nto cap blast radius]
\`\`\``
    },
    // ═══ EBS ══════════════════════════════════════════════════════════════════
    {
        title: 'Amazon EBS – Block Storage for EC2 Workloads',
        skillLevel: 'intermediate', timeToPracticeMins: 45,
        tldr: 'EBS provides persistent block storage for EC2. gp3 is the default (3000 IOPS baseline), io2 Block Express delivers 256K IOPS for databases.',
        beginnerSummary: 'EBS is like a hard drive for your EC2 instance. It persists data even when the instance is stopped or terminated (if configured). You pay for what you provision.',
        proSummary: 'gp3 decouples IOPS from size (up to 16K IOPS at any size vs gp2 3 IOPS/GB). io2 Block Express supports 256K IOPS and 4K MB/s throughput with 99.999% durability. Multi-Attach on io1/io2 enables clustered databases.',
        whyMatters: 'Wrong EBS volume type is the #1 cause of database performance issues on AWS. Understanding gp3 vs io2 vs st1 saves cost and eliminates bottlenecks.',
        commonMistakes: 'Using gp2 instead of gp3 (gp3 is cheaper and better). Not enabling encryption at rest. Forgetting to snapshot before modifications. Using gp3 for sequential-heavy Hadoop (use st1).',
        nextTopicTitle: 'Amazon EFS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon EBS – Elastic Block Store

> 📚 [EBS Volume Types](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-volume-types.html) | [EBS Snapshots](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EBSSnapshots.html)

### Volume Types Comparison

| Volume | Type | Max IOPS | Max MB/s | Use Case |
|---|---|---|---|---|
| **gp3** | SSD | 16,000 | 1,000 | Default – web, dev, boot |
| **io2 Block Express** | SSD | 256,000 | 4,000 | Oracle, SAP HANA, SQL Server |
| **st1** | HDD | 500 | 500 | Hadoop, log processing |
| **sc1** | HDD | 250 | 250 | Infrequent cold storage |

### 🟢 Beginner: Create and Attach a Volume

\`\`\`bash
# Create a gp3 volume
aws ec2 create-volume \\
  --availability-zone us-east-1a \\
  --size 100 \\
  --volume-type gp3 \\
  --iops 6000 \\
  --throughput 250 \\
  --encrypted

# Attach to instance
aws ec2 attach-volume \\
  --volume-id vol-0abc123 \\
  --instance-id i-0abc123 \\
  --device /dev/sdf

# Mount on Linux
sudo mkfs -t xfs /dev/xvdf
sudo mount /dev/xvdf /data
\`\`\`

### 🟡 Intermediate: Automated Snapshots with Data Lifecycle Manager

\`\`\`bash
aws dlm create-lifecycle-policy \\
  --description "Daily DB snapshots, 30-day retention" \\
  --state ENABLED \\
  --execution-role-arn arn:aws:iam::123:role/AWSDataLifecycleManagerDefaultRole \\
  --policy-details '{
    "ResourceTypes": ["VOLUME"],
    "TargetTags": [{"Key": "backup", "Value": "daily"}],
    "Schedules": [{
      "Name": "daily",
      "CreateRule": {"Interval": 24, "IntervalUnit": "HOURS", "Times": ["03:00"]},
      "RetainRule": {"Count": 30},
      "CopyTags": true
    }]
  }'
\`\`\`

### 🔴 Advanced: Multi-Attach for Clustered Databases

\`\`\`mermaid
flowchart LR
    io2[io2 Block Express\nMulti-Attach Volume]
    io2 --> EC2a[EC2 Primary\nDB Node]
    io2 --> EC2b[EC2 Standby\nDB Node]
    EC2a <-->|Cluster Fencing\nSCSI Reservations| EC2b
\`\`\`

\`\`\`bash
# Enable multi-attach (io1/io2 only, same AZ)
aws ec2 create-volume \\
  --availability-zone us-east-1a \\
  --volume-type io2 \\
  --iops 64000 \\
  --size 500 \\
  --multi-attach-enabled

# Cluster software (Oracle RAC / GFS2) handles concurrent access
\`\`\`

### ⚫ Pro: EBS Performance Tuning

\`\`\`bash
# Check I/O queue depth (should be ~32 for database workloads)
iostat -xz 1 | grep xvdf

# Tune Linux I/O scheduler for NVMe EBS
echo none > /sys/block/nvme0n1/queue/scheduler
echo 32   > /sys/block/nvme0n1/queue/nr_requests   # queue depth

# EBS-Optimized bandwidth by instance type
# c6i.4xlarge: 10 Gbps dedicated EBS bandwidth
# m6i.8xlarge: 12.5 Gbps dedicated EBS bandwidth
\`\`\``
    },
    // ═══ EFS ══════════════════════════════════════════════════════════════════
    {
        title: 'Amazon EFS – Elastic Shared File System for Linux Workloads',
        skillLevel: 'intermediate', timeToPracticeMins: 40,
        tldr: 'EFS provides shared NFS storage automatically scaling to petabytes. Multiple EC2 instances mount the same filesystem simultaneously.',
        beginnerSummary: 'EFS is like a shared network drive that every EC2 instance in your VPC can access at once. It grows automatically as you add files.',
        proSummary: 'EFS uses NFSv4.1 over POSIX. Regional with Multi-AZ mount targets. Burst throughput: 100 MB/s baseline + burst credits (50 MB/s per TB). Provisioned Throughput decouples from size. EFS Access Points enforce path and UID/GID for multi-tenant security.',
        whyMatters: 'EFS solves the shared-storage problem for stateful containers, CMS applications, machine learning training data, and CI/CD build artifacts — EBS cannot be shared across instances.',
        commonMistakes: 'Not using EFS Access Points for container security. Using EFS for latency-sensitive workloads (use EBS). Forgetting security group rules on mount targets (port 2049 NFS).',
        nextTopicTitle: 'Amazon FSx', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon EFS – Elastic File System

> 📚 [EFS User Guide](https://docs.aws.amazon.com/efs/latest/ug/) | [EFS Access Points](https://docs.aws.amazon.com/efs/latest/ug/efs-access-points.html)

### EFS vs EBS vs S3

| Feature | EFS | EBS | S3 |
|---|---|---|---|
| Access | Multi-instance NFS | Single instance | HTTP anywhere |
| Protocol | NFSv4.1 | iSCSI/NVMe | REST API |
| Latency | Low (ms) | Very low (sub-ms) | Variable (ms-s) |
| Scaling | Automatic | Manual | Automatic |
| OS | Linux only | Linux + Windows | Any |

### 🟢 Beginner: Mount EFS on EC2

\`\`\`bash
# Install EFS mount helper
sudo yum install -y amazon-efs-utils

# Mount (uses TLS encryption in transit by default)
sudo mkdir /shared
sudo mount -t efs -o tls fs-0abc12345:/ /shared

# Permanent mount via /etc/fstab
echo "fs-0abc12345:/ /shared efs _netdev,tls 0 0" >> /etc/fstab
\`\`\`

### 🟡 Intermediate: EFS for ECS Fargate Persistent Storage

\`\`\`mermaid
flowchart LR
    EFS[EFS File System\nShared /data] --> T1[Fargate Task 1\nsidecars apps]
    EFS --> T2[Fargate Task 2\nsidecars apps]
    EFS --> T3[Fargate Task 3\nsidecars apps]
    T1 --> ALB[Load Balancer]
    T2 --> ALB
    T3 --> ALB
\`\`\`

**ECS Task Definition with EFS volume:**
\`\`\`json
{
  "volumes": [{
    "name": "efs-storage",
    "efsVolumeConfiguration": {
      "fileSystemId": "fs-0abc12345",
      "transitEncryption": "ENABLED",
      "authorizationConfig": {
        "accessPointId": "fsap-0abc12345",
        "iam": "ENABLED"
      }
    }
  }]
}
\`\`\`

### 🔴 Advanced: Access Points for Multi-Tenant Security

\`\`\`bash
# Create access point that enforces /app1 directory + UID 1001
aws efs create-access-point \\
  --file-system-id fs-0abc12345 \\
  --posix-user '{"Uid": 1001, "Gid": 1001}' \\
  --root-directory '{
    "Path": "/app1/data",
    "CreationInfo": {"OwnerUid": 1001, "OwnerGid": 1001, "Permissions": "755"}
  }'
\`\`\`

### Performance Mode & Throughput Mode

\`\`\`text
Performance Modes:
  General Purpose  → web servers, CMS, dev (default, <35K IOPS)
  Max I/O          → big data, analytics (higher latency, unlimited)

Throughput Modes:
  Elastic          → variable workloads, auto-scales (default since 2023)
  Provisioned      → guarantee X MB/s regardless of storage size
  Bursting         → 100 MB/s + 50 MB/s per TB stored (legacy)
\`\`\``
    },
    // ═══ FSx ══════════════════════════════════════════════════════════════════
    {
        title: 'Amazon FSx – High-Performance Managed File Systems',
        skillLevel: 'advanced', timeToPracticeMins: 60,
        tldr: 'FSx offers purpose-built file systems: Lustre for HPC/ML (1M+ IOPS), Windows File Server for AD integration, NetApp ONTAP for hybrid cloud, OpenZFS for NFS workloads.',
        beginnerSummary: 'FSx provides specialized managed file systems for specific workloads: ultra-fast ML training (Lustre), Windows shares (FSx Windows), and enterprise NAS (NetApp ONTAP).',
        proSummary: 'FSx for Lustre links to S3 as warm cache. Persistent deployment survives AZ failures (stored in multiple AZs). FSx ONTAP supports iSCSI, NFS, SMB, and S3 APIs simultaneously. SVM (Storage Virtual Machine) isolation for multi-tenancy.',
        whyMatters: 'Off-the-shelf NFS is too slow for ML training at scale. FSx Lustre delivers 1M IOPS at sub-millisecond latency — the difference between a 6-hour and 1-hour model training run.',
        commonMistakes: 'Using FSx Lustre Scratch (no HA) for production. Not enabling S3 data repository association for Lustre. Forgetting AD connector requirements for FSx Windows.',
        nextTopicTitle: 'AWS Backup', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon FSx – Purpose-Built File Systems

> 📚 [FSx for Lustre](https://docs.aws.amazon.com/fsx/latest/LustreGuide/) | [FSx for Windows](https://docs.aws.amazon.com/fsx/latest/WindowsGuide/) | [FSx ONTAP](https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/)

### FSx Family Comparison

| Product | Protocol | Peak IOPS | Key Use Case |
|---|---|---|---|
| FSx for Lustre | Lustre/POSIX | 1,000,000+ | HPC, ML training, genomics |
| FSx for Windows | SMB | 350,000 | Windows apps, .NET, SQL Server shares |
| FSx for NetApp ONTAP | NFS/SMB/iSCSI | 1,000,000 | Enterprise NAS, SAP, hybrid cloud |
| FSx for OpenZFS | NFS | 350,000 | Linux NFS workloads, dev/test |

### FSx for Lustre – ML Training Scenario

\`\`\`mermaid
flowchart LR
    S3[S3 Training Data\n10 TB] -->|Lazy load / sync| Lustre
    Lustre[FSx Lustre\n1.2 TB/s throughput\nLinked to S3]
    Lustre --> GPU1[EC2 p4d.24xlarge\nGPU Node 1]
    Lustre --> GPU2[EC2 p4d.24xlarge\nGPU Node 2]
    Lustre --> GPU3[EC2 p4d.24xlarge\nGPU Node 3]
    GPU1 --> S3out[S3 Model Artifacts]
\`\`\`

\`\`\`bash
# Create FSx Lustre with S3 data repository
aws fsx create-file-system \\
  --file-system-type LUSTRE \\
  --storage-capacity 7200 \\
  --lustre-configuration '{
    "DeploymentType": "PERSISTENT_2",
    "PerUnitStorageThroughput": 500,
    "DataCompressionType": "LZ4",
    "DataRepositoryConfiguration": {
      "ImportPath": "s3://my-ml-data/training/",
      "ExportPath": "s3://my-ml-data/results/"
    }
  }' \\
  --subnet-ids subnet-0abc

# Mount on EC2
sudo mount -t lustre fs-0abc.fsx.us-east-1.amazonaws.com@tcp:/abc123 /mnt/fsx
\`\`\`

### FSx ONTAP – Hybrid Enterprise NAS

\`\`\`bash
# Create ONTAP file system (Multi-AZ)
aws fsx create-file-system \\
  --file-system-type ONTAP \\
  --storage-capacity 2048 \\
  --ontap-configuration '{
    "DeploymentType": "MULTI_AZ_1",
    "ThroughputCapacity": 1024,
    "FsxAdminPassword": "Admin@2025",
    "RouteTableIds": ["rtb-0abc"]
  }'
# Supports: NFS v3/v4, SMB 3.x, iSCSI, S3 API (via StorageGRID bridge)
# SnapMirror replication to on-prem NetApp for hybrid cloud
\`\`\``
    },
    // ═══ AWS BACKUP ═══════════════════════════════════════════════════════════
    {
        title: 'AWS Backup – Centralized Data Protection Across AWS Services',
        skillLevel: 'intermediate', timeToPracticeMins: 35,
        tldr: 'AWS Backup provides a single policy-driven service to automate backups of EC2, EBS, RDS, DynamoDB, EFS, FSx, S3, and Aurora across accounts and regions.',
        beginnerSummary: 'AWS Backup is like a backup manager for all your AWS resources — instead of configuring snapshots separately for each service, you define one policy and it handles everything.',
        proSummary: 'Backup Plans define schedule + retention + cold storage transition. Vault Lock (WORM) prevents backup deletion even by root. Cross-account backup with Organizations for air-gapped copies. Legal hold for compliance freezes.',
        whyMatters: 'Most breaches include ransomware that deletes backups. Vault Lock with cross-account copies provides immutable, air-gapped protection that survives account-level compromise.',
        commonMistakes: 'Not enabling cross-region copies (single region backups destroyed in region failure). Not using Vault Lock for compliance workloads. Forgetting to include DynamoDB (off by default in backup plans).',
        nextTopicTitle: 'Amazon VPC', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## AWS Backup – Centralized Backup Management

> 📚 [AWS Backup](https://docs.aws.amazon.com/aws-backup/latest/devguide/) | [Vault Lock](https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html)

### Supported Resources

| Service | Backup Type | Cross-Region | Cross-Account |
|---|---|---|---|
| EC2 | AMI + EBS snapshots | ✅ | ✅ |
| RDS / Aurora | DB snapshots | ✅ | ✅ |
| DynamoDB | On-demand backup | ✅ | ✅ |
| EFS / FSx | Backup to S3 | ✅ | ✅ |
| S3 | Continuous backup | ✅ | ✅ |
| EBS | Snapshots | ✅ | ✅ |

### 🟡 Intermediate: Create a Backup Plan

\`\`\`bash
aws backup create-backup-plan \\
  --backup-plan '{
    "BackupPlanName": "production-backup",
    "Rules": [
      {
        "RuleName": "daily-backups",
        "TargetBackupVaultName": "prod-vault",
        "ScheduleExpression": "cron(0 2 * * ? *)",
        "StartWindowMinutes": 60,
        "CompletionWindowMinutes": 120,
        "Lifecycle": {
          "MoveToColdStorageAfterDays": 30,
          "DeleteAfterDays": 365
        },
        "CopyActions": [{
          "DestinationBackupVaultArn": "arn:aws:backup:us-west-2:123:backup-vault:dr-vault",
          "Lifecycle": {"DeleteAfterDays": 365}
        }]
      }
    ]
  }'
\`\`\`

### 🔴 Advanced: Vault Lock (WORM – Ransomware Protection)

\`\`\`mermaid
flowchart LR
    AWS[Primary Account\nBackup Vault] -->|Cross-Account Copy| DR[DR Account\nVault Lock COMPLIANCE]
    DR -->|WORM - Cannot delete\neven as root| IMMUTABLE[Immutable Backups\n30-day min retention]
    RANSOMWARE[Ransomware Attack\nDeletes primary] -.cannot reach.-> DR
\`\`\`

\`\`\`bash
# Create a locked vault — IRREVERSIBLE after lock date
aws backup put-backup-vault-lock-configuration \\
  --backup-vault-name prod-immutable-vault \\
  --min-retention-days 30 \\
  --max-retention-days 365 \\
  --changeable-for-days 3   # 3-day grace period to reconfigure before lock activates
\`\`\`

### ⚫ Pro: Organization-Wide Backup Policy (SCPs + Backup Policies)

\`\`\`json
{
  "plans": {
    "org-daily-plan": {
      "rules": {
        "daily": {
          "schedule_expression": {"@@assign": "cron(0 3 * * ? *)"},
          "target_backup_vault_name": {"@@assign": "Default"},
          "lifecycle": {
            "delete_after_days": {"@@assign": "90"}
          }
        }
      },
      "selections": {
        "tags": {
          "my-backup-resources": {
            "iam_role_arn": {"@@assign": "arn:aws:iam::$account:role/AWSBackupRole"},
            "tag_key": {"@@assign": "backup"},
            "tag_value": {"@@assign": ["daily"]}
          }
        }
      }
    }
  }
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
