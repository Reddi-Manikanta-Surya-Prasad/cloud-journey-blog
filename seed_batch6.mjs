// seed_batch6.mjs — Containers & DevOps: ECS + Fargate + EKS + ECR + CodePipeline
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch6.mjs
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
        title: 'Amazon ECS & Fargate – Containers Without Managing Servers',
        skillLevel: 'intermediate', timeToPracticeMins: 55,
        tldr: 'ECS runs Docker containers on AWS. Fargate removes the EC2 layer entirely — define your CPU/memory, push your image, and AWS runs it. No cluster management needed.',
        beginnerSummary: 'ECS is AWS\'s container service. Think of it as a manager that runs your Docker containers, keeps them healthy, and scales them up when traffic increases. Fargate means you never touch a server.',
        proSummary: 'ECS task placement constraints for EC2: AZ spread, distinct instance, custom expressions. Fargate pricing: vCPU-sec + GB-sec, more expensive than EC2 at baseline but no idle capacity. Service Connect replaces App Mesh for service-to-service networking. ECS Exec (AWS SSM) for container debugging without SSH.',
        whyMatters: 'Fargate is the fastest path from Dockerfile to production for most teams. No AMI management, no cluster scaling policies, no EC2 patching. The productivity gain over running your own Kubernetes is substantial for most applications.',
        commonMistakes: 'Not setting CPU/memory limits on Fargate (causing task eviction). Using bridge networking instead of awsvpc mode (prevents security groups per task). Not setting log driver to awslogs (containers run blind).',
        nextTopicTitle: 'Amazon EKS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon ECS & Fargate – Container Orchestration

> 📚 [ECS Developer Guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/) | [Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)

### ECS Concepts

\`\`\`mermaid
flowchart LR
    ECR[ECR\nContainer Registry] --> TD[Task Definition\nImage + CPU + Mem + Env]
    TD --> SERVICE[ECS Service\nDesired Count: 3]
    SERVICE --> T1[Fargate Task 1]
    SERVICE --> T2[Fargate Task 2]
    SERVICE --> T3[Fargate Task 3]
    ALB[ALB] --> T1 & T2 & T3
    CW[CloudWatch\nTarget Tracking] -->|Scale out/in| SERVICE
\`\`\`

### Task Definition

\`\`\`json
{
  "family": "web-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123:role/ecsTaskRole",
  "containerDefinitions": [{
    "name": "web-api",
    "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/web-api:v2.1.0",
    "portMappings": [{"containerPort": 8080, "protocol": "tcp"}],
    "environment": [{"name": "NODE_ENV", "value": "production"}],
    "secrets": [{"name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:..."}],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {"awslogs-group": "/ecs/web-api", "awslogs-region": "us-east-1"}
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"],
      "interval": 30, "timeout": 5, "retries": 3
    }
  }]
}
\`\`\`

### Create ECS Service with Auto Scaling

\`\`\`bash
aws ecs create-service \\
  --cluster prod \\
  --service-name web-api \\
  --task-definition web-api:5 \\
  --desired-count 3 \\
  --launch-type FARGATE \\
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-a,subnet-b],securityGroups=[sg-app],assignPublicIp=DISABLED}' \\
  --load-balancers 'targetGroupArn=arn:...,containerName=web-api,containerPort=8080' \\
  --deployment-configuration 'minimumHealthyPercent=50,maximumPercent=200'

# Auto scaling (target 70% CPU)
aws application-autoscaling register-scalable-target \\
  --service-namespace ecs --resource-id service/prod/web-api \\
  --scalable-dimension ecs:service:DesiredCount --min-capacity 2 --max-capacity 20

aws application-autoscaling put-scaling-policy \\
  --service-namespace ecs --resource-id service/prod/web-api \\
  --scalable-dimension ecs:service:DesiredCount \\
  --policy-name cpu-tracking \\
  --policy-type TargetTrackingScaling \\
  --target-tracking-scaling-policy-configuration '{"TargetValue":70,"PredefinedMetricSpecification":{"PredefinedMetricType":"ECSServiceAverageCPUUtilization"}}'
\`\`\``
    },
    {
        title: 'Amazon EKS – Managed Kubernetes for Production Workloads',
        skillLevel: 'advanced', timeToPracticeMins: 90,
        tldr: 'EKS provides a managed Kubernetes control plane. Add Karpenter for smart node provisioning, Fargate profiles for serverless pods, and EKS add-ons for CoreDNS, VPC CNI, and kube-proxy.',
        beginnerSummary: 'EKS runs Kubernetes on AWS with the control plane managed for you. Kubernetes orchestrates containers at massive scale — EKS removes the hardest parts (control plane HA, patching, backups).',
        proSummary: 'EKS uses AWS VPC CNI — each pod gets a real VPC IP from an ENI (supports security groups per pod). Karpenter consolidates nodes 2-3× better than cluster-autoscaler. EKS Fargate eliminates node management but doesn\'t support StatefulSets with local storage or DaemonSets. IRSA (IAM Roles for Service Accounts) via OIDC federated identity is the correct way to grant pods AWS API access.',
        whyMatters: 'Kubernetes is the industry standard for deploying containerized applications at scale. EKS lets you use Helm charts, kubectl, and the entire Kubernetes ecosystem without managing etcd, API servers, or control plane HA.',
        commonMistakes: 'Granting nodes full EC2 IAM permissions instead of IRSA per-pod. Not using Karpenter (cluster-autoscaler is slow to scale, wastes money). Running stateful workloads on Fargate profiles (no DaemonSet support).',
        nextTopicTitle: 'Amazon ECR', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon EKS – Managed Kubernetes

> 📚 [EKS User Guide](https://docs.aws.amazon.com/eks/latest/userguide/) | [Karpenter](https://karpenter.sh) | [IRSA](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)

### EKS Architecture

\`\`\`mermaid
flowchart LR
    DEV[Developer\nkubectl / Helm] --> APISERV[EKS Control Plane\nManaged by AWS]
    APISERV --> NG1[Node Group\nm6i.2xlarge × 3]
    APISERV --> KARP[Karpenter\nManaged Nodes]
    APISERV --> FARGATE[Fargate Profile\nServerless Pods]
    NG1 --> POD1[Pods: web-api]
    KARP --> POD2[Pods: batch-jobs]
    FARGATE --> POD3[Pods: monitoring]
    ALB[AWS Load Balancer\nController] --> SVC[K8s Services]
\`\`\`

### Create EKS Cluster with eksctl

\`\`\`bash
eksctl create cluster \\
  --name prod \\
  --region us-east-1 \\
  --version 1.31 \\
  --nodegroup-name standard-workers \\
  --node-type m7g.xlarge \\
  --nodes-min 2 \\
  --nodes-max 10 \\
  --managed
\`\`\`

### IRSA – IAM Roles for Service Accounts (Zero Privilege Pods)

\`\`\`bash
# Associate OIDC provider with cluster
eksctl utils associate-iam-oidc-provider --cluster prod --approve

# Create service account with S3 read-only access
eksctl create iamserviceaccount \\
  --cluster prod \\
  --namespace default \\
  --name s3-reader \\
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \\
  --approve
\`\`\`

\`\`\`yaml
# Deployment using the IRSA service account
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-processor
spec:
  replicas: 3
  template:
    spec:
      serviceAccountName: s3-reader   # Gets injected AWS_WEB_IDENTITY_TOKEN_FILE env var
      containers:
      - name: processor
        image: 123.dkr.ecr.us-east-1.amazonaws.com/processor:v1.2
        resources:
          requests: {cpu: "500m", memory: "512Mi"}
          limits:   {cpu: "1000m", memory: "1Gi"}
\`\`\`

### Karpenter NodePool – Intelligent Provisioning

\`\`\`yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["c", "m", "r"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["5"]
  limits:
    cpu: "1000"
  disruption:
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
\`\`\``
    },
    {
        title: 'Amazon ECR & AWS CodePipeline – Container Registry & CI/CD',
        skillLevel: 'intermediate', timeToPracticeMins: 50,
        tldr: 'ECR hosts private Docker images with lifecycle policies and vulnerability scanning. CodePipeline orchestrates full CI/CD: source → build → test → deploy to ECS/EKS/Lambda.',
        beginnerSummary: 'ECR stores your Docker images securely in AWS. CodePipeline automatically builds and deploys your code whenever you push to GitHub — no manual deployments ever again.',
        proSummary: 'ECR pulls within same region are free (no bandwidth charge). Enhanced Scanning uses Inspector to detect CVEs in images on push + continuously. CodePipeline V2 supports pull request workflows and custom variables. Cross-account ECR requires resource policy + kms:Decrypt for encrypted repos.',
        whyMatters: 'Manual deployments cause human error and slow release cycles. CodePipeline + ECR enables deploy-on-commit workflows where every push triggers automated testing and zero-downtime ECS rolling deployments.',
        commonMistakes: 'Not setting ECR lifecycle policies (images accumulate indefinitely, costs grow). Building Docker images in CodeBuild without layer caching (4× slower builds). Not scanning images before deployment.',
        nextTopicTitle: 'Amazon CloudWatch Advanced', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon ECR & CodePipeline – Container CI/CD

> 📚 [ECR User Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/) | [CodePipeline](https://docs.aws.amazon.com/codepipeline/latest/userguide/)

### Full CI/CD Pipeline Architecture

\`\`\`mermaid
flowchart LR
    GH[GitHub Push\nmain branch] --> CP[CodePipeline]
    CP --> CB[CodeBuild\nDocker build + test]
    CB --> ECR[ECR\nPush image:sha-abc123]
    ECR --> SCAN[Inspector\nVulnerability scan]
    SCAN -->|Pass| ECS[ECS Rolling Deploy\nBlue/Green or Rolling]
    SCAN -->|CRITICAL CVE| FAIL[Pipeline FAILED\nSlack alert]
\`\`\`

### ECR Setup with Lifecycle Policy

\`\`\`bash
# Create private repository
aws ecr create-repository \\
  --repository-name web-api \\
  --image-scanning-configuration scanOnPush=true \\
  --encryption-configuration encryptionType=KMS

# Lifecycle policy: keep last 10 prod images, delete untagged after 1 day
aws ecr put-lifecycle-policy \\
  --repository-name web-api \\
  --lifecycle-policy-text '{
    "rules": [
      {
        "rulePriority": 1,
        "description": "Keep last 10 production images",
        "selection": {"tagStatus": "tagged", "tagPrefixList": ["prod-"], "countType": "imageCountMoreThan", "countNumber": 10},
        "action": {"type": "expire"}
      },
      {
        "rulePriority": 2,
        "description": "Delete untagged images after 1 day",
        "selection": {"tagStatus": "untagged", "countType": "sinceImagePushed", "countUnit": "days", "countNumber": 1},
        "action": {"type": "expire"}
      }
    ]
  }'
\`\`\`

### CodeBuild – Buildspec for Docker

\`\`\`yaml
version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
      - IMAGE_TAG=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
  build:
    commands:
      - docker build --cache-from $ECR_REGISTRY/web-api:latest -t web-api:$IMAGE_TAG .
      - docker tag web-api:$IMAGE_TAG $ECR_REGISTRY/web-api:$IMAGE_TAG
      - docker tag web-api:$IMAGE_TAG $ECR_REGISTRY/web-api:latest
  post_build:
    commands:
      - docker push $ECR_REGISTRY/web-api:$IMAGE_TAG
      - docker push $ECR_REGISTRY/web-api:latest
      - printf '[{"name":"web-api","imageUri":"%s"}]' $ECR_REGISTRY/web-api:$IMAGE_TAG > imagedefinitions.json
artifacts:
  files: imagedefinitions.json
\`\`\`

### ECS Blue/Green Deployment with CodeDeploy

\`\`\`text
Blue (current): ECS tasks running v1.2
         ↓ CodeDeploy shifts 10% traffic to Green
Green (new):  ECS tasks running v1.3
         ↓ After canary validation (10min)
Green gets 100% traffic, Blue terminated after 5min draining
         ↓ Rollback: shift traffic back to Blue in <30s if alarms trigger
\`\`\``
    },
    {
        title: 'AWS CloudTrail & AWS Organizations – Audit Logs & Multi-Account Governance',
        skillLevel: 'intermediate', timeToPracticeMins: 40,
        tldr: 'CloudTrail records every API call in your AWS account. Organizations provides multi-account management with consolidated billing, SCPs, and centralized policies across hundreds of accounts.',
        beginnerSummary: 'CloudTrail is your security camera — it records who did what in your AWS account and when. Organizations lets you manage multiple AWS accounts from one place with shared policies and billing.',
        proSummary: 'CloudTrail Insights automatically detects unusual API activity. Trail in every region required for complete audit trail (or use org trail). Data events (S3 GetObject, Lambda invoke) are expensive — filter with advanced selectors. Organizations: SCP + Tag Policies + Backup Policies + AI/Service Opt-Out Policies via policy types.',
        whyMatters: 'Missing CloudTrail is a compliance failure and makes breach investigation impossible. Organizations is mandatory for enterprise AWS — it\'s how you enforce security guardrails across 100+ accounts without manual work.',
        commonMistakes: 'Only enabling management events (misses S3 data access). Not enabling CloudTrail log file validation (easy to tamper without it). Not using organization trail (each account needs its own without it).',
        nextTopicTitle: 'AWS SQS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## CloudTrail & AWS Organizations – Governance at Scale

> 📚 [CloudTrail User Guide](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/) | [Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/)

### Organization Trail – One Trail for All Accounts

\`\`\`mermaid
flowchart LR
    ORG[AWS Organization\nManagement Account] --> TRAIL[CloudTrail Org Trail]
    ACC1[Member Account 1] -->|API Calls| TRAIL
    ACC2[Member Account 2] -->|API Calls| TRAIL
    ACC3[Member Account 3] -->|API Calls| TRAIL
    TRAIL --> S3[Central S3 Bucket\nLog Archive Account]
    S3 --> ATHENA[Athena\nSecurity Queries]
    TRAIL --> CW[CloudWatch Logs\nReal-time alerts via SNS]
\`\`\`

\`\`\`bash
# Create organization-wide trail
aws cloudtrail create-trail \\
  --name org-audit-trail \\
  --s3-bucket-name org-cloudtrail-logs-archive \\
  --is-organization-trail \\
  --include-global-service-events \\
  --is-multi-region-trail \\
  --enable-log-file-validation  # SHA-256 digest for tamper detection

aws cloudtrail start-logging --name org-audit-trail
\`\`\`

### Athena Query – Detect Suspicious Root Usage

\`\`\`sql
SELECT eventTime, eventName, sourceIPAddress, userAgent
FROM cloudtrail_logs
WHERE useridentity.type = 'Root'
  AND eventTime > date_add('day', -7, NOW())
ORDER BY eventTime DESC;
\`\`\`

### Organizations – Account Structure & SCPs

\`\`\`text
Root
├── Security OU (read-only, restricted SCPs)
│   ├── Log Archive Account
│   └── Security Tooling Account
├── Infrastructure OU
│   ├── Network Account (Transit Gateway hub)
│   └── DNS Account
├── Workloads OU
│   ├── Production OU  ← Strictest SCPs
│   │   ├── App-A Account
│   │   └── App-B Account
│   └── Dev OU         ← Relaxed SCPs
│       └── Dev Account
└── Sandbox OU         ← Most permissive
    └── Experiment Accounts
\`\`\`

\`\`\`bash
# Enforce SCP: block root login except from known IP
aws organizations create-policy \\
  --type SERVICE_CONTROL_POLICY \\
  --name DenyRootFromUnknownIP \\
  --content '{
    "Statement": [{
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "Bool": {"aws:MultiFactorAuthPresent": "false"},
        "StringEquals": {"aws:PrincipalType": "Root"}
      }
    }]
  }'
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
