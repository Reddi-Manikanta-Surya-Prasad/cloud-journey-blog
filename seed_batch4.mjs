// seed_batch4.mjs — Security: IAM Advanced + KMS + Cognito + WAF + GuardDuty + Secrets Manager
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch4.mjs
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
    title: 'AWS IAM Advanced – SCPs, Permission Boundaries & Attribute-Based Access',
    skillLevel: 'advanced', timeToPracticeMins: 75,
    tldr: 'Advanced IAM uses SCPs to enforce guardrails across an org, Permission Boundaries to delegate role creation safely, and ABAC with tags for scalable access control.',
    beginnerSummary: 'Advanced IAM protects your entire AWS organization — Service Control Policies block dangerous actions even for admins, and tag-based access control scales permissions without writing hundreds of policies.',
    proSummary: 'SCP evaluation: explicit Deny > SCP Allow > Identity policy Allow. Permission Boundaries are an AND condition with identity policies. ABAC with aws:PrincipalTag and aws:ResourceTag reduces policy count from O(users×resources) to O(1). IAM Access Analyzer validates external exposure.',
    whyMatters: 'IAM misconfigurations are the #1 cloud breach cause. SCPs provide a safety net that even compromised admin credentials cannot bypass. ABAC enables 1000-engineer orgs to manage permissions with 5 policies.',
    commonMistakes: 'Thinking SCPs grant permissions (they only restrict). Forgetting Permission Boundaries still need identity policy to allow the action. Not using IAM Access Analyzer to detect public resource exposure.',
    nextTopicTitle: 'AWS KMS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## AWS IAM Advanced – Org-Wide Security Controls

> 📚 [SCPs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_type-auth.html) | [Permission Boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html) | [ABAC](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction_attribute-based-access-control.html)

### IAM Policy Evaluation Logic

\`\`\`mermaid
flowchart TD
    R[API Request] --> D1{Explicit DENY\nin any policy?}
    D1 -->|YES| DENY[❌ Denied]
    D1 -->|NO| D2{SCP allows\nthe action?}
    D2 -->|NO| DENY
    D2 -->|YES| D3{Identity policy\nallows action?}
    D3 -->|NO| DENY
    D3 -->|YES| D4{Resource policy\ndenies?}
    D4 -->|YES| DENY
    D4 -->|NO| ALLOW[✅ Allowed]
\`\`\`

### Service Control Policy – Deny Region Usage

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "DenyNonApprovedRegions",
    "Effect": "Deny",
    "NotAction": [
      "iam:*", "organizations:*", "route53:*",
      "cloudfront:*", "sts:*", "support:*"
    ],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": {
        "aws:RequestedRegion": ["us-east-1", "us-west-2", "eu-west-1"]
      }
    }
  }]
}
\`\`\`

### ABAC – Tag-Based Access Control

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "ec2:*",
    "Resource": "*",
    "Condition": {
      "StringEquals": {
        "aws:ResourceTag/Project": "\${aws:PrincipalTag/Project}",
        "aws:ResourceTag/Env":     "\${aws:PrincipalTag/Env}"
      }
    }
  }]
}
\`\`\`
User with tags **Project=payments, Env=prod** → can only touch resources tagged **Project=payments, Env=prod**.

### IAM Access Analyzer – Detect External Exposure

\`\`\`bash
aws accessanalyzer create-analyzer \\
  --analyzer-name org-analyzer \\
  --type ORGANIZATION

# List findings (resources accessible from outside org)
aws accessanalyzer list-findings \\
  --analyzer-arn arn:aws:access-analyzer:... \\
  --filter '{"status": {"eq": ["ACTIVE"]}}'
\`\`\``
  },
  {
    title: 'AWS KMS – Encryption Keys, CMKs & Envelope Encryption',
    skillLevel: 'intermediate', timeToPracticeMins: 40,
    tldr: 'KMS manages encryption keys. You never see the raw key material — KMS encrypts/decrypts data for you. Envelope encryption wraps data keys with CMKs for performance at scale.',
    beginnerSummary: 'KMS is AWS\'s key management service. Think of it as a vault that holds your encryption keys. When you want to encrypt data, KMS does it for you — the key never leaves AWS.',
    proSummary: 'KMS CMKs: AWS-managed (free, no control), Customer-managed (control + audit), External key material (BYOK), XKS (keys in your HSM). Envelope encryption: generate DEK via GenerateDataKey, encrypt data locally, store encrypted DEK with data. Automatic key rotation: 1 year for CMKs.',
    whyMatters: 'Every regulated workload (HIPAA, PCI, SOC2) requires encryption. KMS integrates with 100+ AWS services. Understanding envelope encryption is required for the Solutions Architect exam and real-world data security.',
    commonMistakes: 'Using AWS-managed keys when you need key deletion control. Not enabling CloudTrail logging of KMS API calls. Forgetting to grant kms:GenerateDataKey in addition to kms:Decrypt for application IAM roles.',
    nextTopicTitle: 'Amazon Cognito', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## AWS KMS – Key Management Service

> 📚 [KMS Developer Guide](https://docs.aws.amazon.com/kms/latest/developerguide/) | [Envelope Encryption](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)

### Key Types Comparison

| Type | Control | Cost | Rotation | Use Case |
|---|---|---|---|---|
| AWS-managed | None | Free | Auto (3yr) | Default S3, EBS, RDS encryption |
| Customer-managed (CMK) | Full | $1/mo | Optional (1yr) | Application-level encryption |
| External (BYOK) | Key material | $1/mo | Manual | Compliance: key origin control |
| XKS (External Key Store) | Your HSM | $1/mo | Manual | Keys never enter AWS |

### Envelope Encryption Pattern

\`\`\`mermaid
flowchart LR
    APP[Application] -->|1. GenerateDataKey| KMS[AWS KMS CMK]
    KMS -->|2. Returns plaintext DEK + encrypted DEK| APP
    APP -->|3. Encrypt data with plaintext DEK| DATA[Encrypted Data]
    APP -->|4. Discard plaintext DEK| TRASH[Gone from memory]
    APP -->|5. Store encrypted DEK alongside data| DATA
\`\`\`

\`\`\`python
import boto3, os
from cryptography.fernet import Fernet

kms = boto3.client('kms')
KEY_ID = 'arn:aws:kms:us-east-1:123:key/abc-def'

def encrypt(plaintext: str) -> dict:
    # Step 1: Get a data encryption key (256-bit AES)
    response = kms.generate_data_key(KeyId=KEY_ID, KeySpec='AES_256')
    plaintext_key = response['Plaintext']        # Use this, then discard
    encrypted_key = response['CiphertextBlob']   # Store this safely

    # Step 2: Encrypt data locally (fast, no KMS call needed)
    f = Fernet(base64.urlsafe_b64encode(plaintext_key[:32]))
    ciphertext = f.encrypt(plaintext.encode())

    return {'ciphertext': ciphertext, 'encrypted_key': encrypted_key}

def decrypt(payload: dict) -> str:
    # Step 1: Decrypt the data key with KMS
    plaintext_key = kms.decrypt(CiphertextBlob=payload['encrypted_key'])['Plaintext']

    # Step 2: Decrypt data locally
    f = Fernet(base64.urlsafe_b64encode(plaintext_key[:32]))
    return f.decrypt(payload['ciphertext']).decode()
\`\`\`

### Key Policy – Grant Application Access

\`\`\`json
{
  "Statement": [
    {
      "Sid": "Allow app to encrypt/decrypt",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::123:role/app-role"},
      "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
      "Resource": "*"
    },
    {
      "Sid": "Allow admin rotation",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::123:role/admin-role"},
      "Action": "kms:*",
      "Resource": "*"
    }
  ]
}
\`\`\``
  },
  {
    title: 'Amazon Cognito – User Authentication, OAuth & Social Login',
    skillLevel: 'intermediate', timeToPracticeMins: 45,
    tldr: 'Cognito provides user pools (authentication) and identity pools (AWS credentials). Supports email/password, MFA, social login (Google, Facebook, Apple), and SAML for enterprise SSO.',
    beginnerSummary: 'Cognito is AWS\'s sign-up/sign-in service. Add it to your app and get email/password login, Google/Facebook login, MFA, and JWT tokens — all managed by AWS, no servers needed.',
    proSummary: 'User Pool triggers (Pre-Auth, Post-Confirm, Pre-Token-Gen) allow custom logic injection. Identity Pools assume IAM roles based on user pool group. Hosted UI provides OAuth2/OIDC flow. Token refresh: access token 1hr, refresh token up to 3650 days.',
    whyMatters: 'Building auth from scratch takes weeks and introduces security risks. Cognito provides enterprise-grade auth (OAuth 2.0, PKCE, MFA) in hours with zero server management.',
    commonMistakes: 'Storing ID tokens in localStorage (should use httpOnly cookies or memory). Not enabling MFA for admin groups. Using client secret in SPA code (public clients must use PKCE not client secret).',
    nextTopicTitle: 'AWS WAF', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## Amazon Cognito – Managed Authentication

> 📚 [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html) | [Identity Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-identity.html)

### Cognito Architecture

\`\`\`mermaid
flowchart LR
    USER[User] -->|1. Sign In| HP[Cognito Hosted UI\nOAuth 2.0]
    HP -->|MFA if enabled| MFA[TOTP / SMS]
    MFA -->|2. JWT Tokens\nID + Access + Refresh| APP[Your App]
    APP -->|3. Call API with AccessToken| APIGW[API Gateway / ALB]
    APIGW -->|4. Validate JWT| COGNITO[Cognito JWKS endpoint]
    APP -->|5. Get AWS creds via Identity Pool| CREDS[Temp AWS Creds\nvia STS AssumeRoleWithWebIdentity]
\`\`\`

### Create User Pool with Google Social Login

\`\`\`bash
aws cognito-idp create-user-pool \\
  --pool-name MyAppPool \\
  --policies '{"PasswordPolicy":{"MinimumLength":12,"RequireUppercase":true,"RequireNumbers":true,"RequireSymbols":true}}' \\
  --mfa-configuration OPTIONAL \\
  --email-configuration '{"EmailSendingAccount":"DEVELOPER","From":"support@example.com","SourceArn":"arn:aws:ses:..."}' \\
  --schema Name=email,Required=true Name=given_name,Required=true
\`\`\`

### Pre-Token Generation Trigger (Add Custom Claims)

\`\`\`javascript
// Lambda trigger: runs before Cognito issues tokens
exports.handler = async (event) => {
  // Add role from your DB to the JWT instead of Cognito groups
  const userRole = await getUserRole(event.userName);

  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        'custom:role': userRole,
        'custom:orgId': event.request.userAttributes['custom:orgId']
      }
    }
  };
  return event;
};
\`\`\`

### Token Usage in Frontend (PKCE Flow for SPAs)

\`\`\`javascript
// Never use client_secret in browser — use PKCE instead
import { Amplify } from 'aws-amplify';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

// Get current JWT tokens
const session = await fetchAuthSession();
const accessToken = session.tokens?.accessToken.toString();

// Use in API calls
const response = await fetch('https://api.example.com/orders', {
  headers: { 'Authorization': \`Bearer \${accessToken}\` }
});
\`\`\``
  },
  {
    title: 'AWS WAF & GuardDuty – Web Application Firewall & Threat Detection',
    skillLevel: 'advanced', timeToPracticeMins: 60,
    tldr: 'WAF filters malicious HTTP traffic with managed rule groups. GuardDuty continuously analyzes CloudTrail, VPC Flow Logs, and DNS logs using ML to detect threats like cryptomining and credential exfiltration.',
    beginnerSummary: 'WAF blocks bad web traffic (SQL injection, bots, scrapers) before it hits your servers. GuardDuty watches everything happening in your AWS account and alerts you when something suspicious occurs.',
    proSummary: 'WAF v2: Web ACLs inspect all 8,192 bytes of header + body. Rate-based rules use 5min sliding windows. Managed rule groups include AWSManagedRulesCommonRuleSet (OWASP Top 10) and AWSManagedRulesBotControlRuleSet. GuardDuty findings: CRITICAL (active attack) vs HIGH (compromise indicator) vs MEDIUM (recon).',
    whyMatters: 'WAF stops the most common attacks automatically with managed rules. GuardDuty detected compromised credentials used by cryptominers within minutes in multiple real-world incidents that security teams missed for days.',
    commonMistakes: 'Putting WAF in Count mode and forgetting to switch to Block. Not enabling GuardDuty EKS / Lambda / S3 protection add-ons. Not setting suppression rules for known benign patterns causing false positives.',
    nextTopicTitle: 'AWS Secrets Manager', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## AWS WAF & GuardDuty – Defense in Depth

> 📚 [WAF Developer Guide](https://docs.aws.amazon.com/waf/latest/developerguide/) | [GuardDuty User Guide](https://docs.aws.amazon.com/guardduty/latest/ug/)

### WAF + GuardDuty Defense Architecture

\`\`\`mermaid
flowchart LR
    INTERNET[Internet Traffic] --> CF[CloudFront]
    CF --> WAF[AWS WAF Web ACL\nManaged Rules + Custom]
    WAF -->|Blocked| BLACK[403 Response]
    WAF -->|Allowed| ALB[Application Load Balancer]
    ALB --> APP[Application]
    CW[CloudTrail\nVPC Flow Logs\nDNS Logs] --> GD[GuardDuty\nML Threat Detection]
    GD -->|Finding| EB[EventBridge]
    EB --> SNS[SNS → PagerDuty]
    EB --> LAM[Lambda Auto-Remediation]
\`\`\`

### WAF Web ACL with Managed Rules

\`\`\`bash
aws wafv2 create-web-acl \\
  --name prod-web-acl \\
  --scope CLOUDFRONT \\
  --default-action Allow={} \\
  --rules '[
    {
      "Name": "AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "OverrideAction": {"None": {}},
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRules"
      }
    },
    {
      "Name": "RateLimit",
      "Priority": 0,
      "Action": {"Block": {}},
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      }
    }
  ]'
\`\`\`

### GuardDuty Auto-Remediation with Lambda

\`\`\`python
import boto3, json

def handler(event, context):
    detail = event['detail']
    finding_type = detail['type']
    severity = detail['severity']

    # High severity: isolate compromised instance
    if severity >= 7 and 'UnauthorizedAccess' in finding_type:
        instance_id = detail['resource']['instanceDetails']['instanceId']
        ec2 = boto3.client('ec2')

        # Attach isolation security group (no ingress/egress)
        ec2.modify_instance_attribute(
            InstanceId=instance_id,
            Groups=['sg-isolation-no-traffic']
        )
        print(f"ISOLATED: {instance_id} due to {finding_type}")
\`\`\``
  },
  {
    title: 'AWS Secrets Manager – Rotate, Store & Access Secrets Securely',
    skillLevel: 'intermediate', timeToPracticeMins: 35,
    tldr: 'Secrets Manager stores database passwords, API keys, and credentials. Automatic rotation changes passwords on a schedule without application restarts.',
    beginnerSummary: 'Instead of hardcoding database passwords in your code, store them in Secrets Manager. Your app fetches the password at runtime and Secrets Manager can rotate it automatically.',
    proSummary: 'Multi-Region secrets replicate to secondary regions for DR. Rotation uses a Lambda that follows the 4-step pattern: createSecret → setSecret → testSecret → finishSecret. ResourcePolicy enables cross-account access. Cache client-side with 5-min TTL to avoid API throttling.',
    whyMatters: 'Hardcoded credentials in code/environment variables are the #1 secret exposure vector. Secrets Manager + rotation means the exposed secret becomes invalid within hours of the rotation schedule.',
    commonMistakes: 'Using Secrets Manager when SSM Parameter Store SecureString suffices (Secrets Manager costs $0.40/secret/mo). Calling GetSecretValue on every request (add client-side caching). Not testing rotation Lambda before enabling auto-rotation.',
    nextTopicTitle: 'Amazon RDS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## AWS Secrets Manager – Credential Lifecycle Management

> 📚 [Secrets Manager User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/) | [Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)

### Secrets Manager vs SSM Parameter Store

| Feature | Secrets Manager | SSM Parameter Store |
|---|---|---|
| Cost | $0.40/secret/mo | Free (Standard) |
| Max size | 65 KB | 4 KB (Standard), 8 KB (Advanced) |
| Auto-rotation | ✅ Built-in for RDS, Redshift | ❌ DIY with Lambda |
| Cross-account | ✅ via Resource Policy | ❌ |
| Versioning | ✅ AWSCURRENT, AWSPREVIOUS | ✅ |
| Best for | DB passwords, API keys | Config values, small secrets |

### Store and Retrieve a Secret

\`\`\`bash
# Store RDS credentials
aws secretsmanager create-secret \\
  --name prod/rds/master \\
  --secret-string '{"username":"admin","password":"MyPass@2025","host":"db.example.com","port":5432,"dbname":"prod"}'

# Retrieve in app
aws secretsmanager get-secret-value --secret-id prod/rds/master --query SecretString --output text
\`\`\`

### Application Code with Caching (Python)

\`\`\`python
import boto3, json
from functools import lru_cache
from datetime import datetime, timedelta

class SecretsCache:
    def __init__(self):
        self.client = boto3.client('secretsmanager')
        self._cache = {}

    def get(self, secret_id: str) -> dict:
        entry = self._cache.get(secret_id)
        if entry and entry['expires'] > datetime.now():
            return entry['value']

        response = self.client.get_secret_value(SecretId=secret_id)
        value = json.loads(response['SecretString'])
        self._cache[secret_id] = {
            'value': value,
            'expires': datetime.now() + timedelta(minutes=5)  # 5min cache
        }
        return value

secrets = SecretsCache()

def get_db_connection():
    creds = secrets.get('prod/rds/master')
    return psycopg2.connect(
        host=creds['host'], user=creds['username'],
        password=creds['password'], dbname=creds['dbname']
    )
\`\`\`

### Auto-Rotation Architecture

\`\`\`mermaid
flowchart LR
    SM[Secrets Manager\nSchedule: every 30 days] -->|Invoke| ROT[Rotation Lambda]
    ROT -->|1. createSecret\n2. setSecret\n3. testSecret\n4. finishSecret| DB[RDS Database]
    DB -->|New password active| ROT
    APP[Application] -->|GetSecretValue\nAWSCURRENT| SM
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
