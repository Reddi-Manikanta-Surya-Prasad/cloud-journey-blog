// seed_batch3.mjs — Networking: VPC Advanced + Route53 + CloudFront + API Gateway + ALB
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch3.mjs
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
    title: 'Amazon VPC Advanced – Peering, Transit Gateway & PrivateLink',
    skillLevel: 'advanced', timeToPracticeMins: 75,
    tldr: 'Connect multiple VPCs with Transit Gateway (hub-and-spoke), expose services privately via PrivateLink, and filter traffic with Network ACLs vs Security Groups.',
    beginnerSummary: 'Advanced VPC connects multiple isolated networks together — either directly (peering) or through a central hub (Transit Gateway). PrivateLink lets you access AWS services without going over the internet.',
    proSummary: 'TGW route tables enable network segmentation (prod vs dev). VPC Peering is non-transitive (A-B + B-C does not give A-C). PrivateLink creates ENIs in consumer VPC — DNS resolution must return private IP. Flow Logs → Athena for forensics.',
    whyMatters: 'Enterprise AWS architectures span dozens of VPCs across accounts and regions. Transit Gateway and PrivateLink are foundational for secure, scalable multi-account networking.',
    commonMistakes: 'Overlapping CIDR blocks block VPC peering forever. Assuming VPC peering is transitive. Not enabling DNS hostname resolution on VPC for PrivateLink to work.',
    nextTopicTitle: 'Amazon Route 53', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## Amazon VPC Advanced – Multi-VPC Networking

> 📚 [Transit Gateway](https://docs.aws.amazon.com/vpc/latest/tgw/) | [VPC PrivateLink](https://docs.aws.amazon.com/vpc/latest/privatelink/) | [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html)

### Transit Gateway vs VPC Peering

| Feature | VPC Peering | Transit Gateway |
|---|---|---|
| Topology | Point-to-point | Hub-and-spoke |
| Transitive routing | ❌ | ✅ |
| Cross-account | ✅ | ✅ |
| Cross-region | ✅ (peering) | ✅ (peering) |
| Bandwidth limit | None | 50 Gbps per AZ |
| Cost | Free (data transfer charged) | $0.05/hr + $0.02/GB |

### Transit Gateway Architecture

\`\`\`mermaid
flowchart LR
    TGW[Transit Gateway\nHub]
    PROD[VPC Prod\n10.0.0.0/16] --> TGW
    DEV[VPC Dev\n10.1.0.0/16] --> TGW
    SHARED[VPC Shared Services\n10.2.0.0/16] --> TGW
    ON_PREM[On-Prem DC\nDirect Connect] --> TGW
    TGW --> INTERNET[Internet via\nShared NAT Gateway]
\`\`\`

\`\`\`bash
# Create TGW attachment for Prod VPC
aws ec2 create-transit-gateway-vpc-attachment \\
  --transit-gateway-id tgw-0abc \\
  --vpc-id vpc-prod \\
  --subnet-ids subnet-a subnet-b

# Route Prod → Shared Services
aws ec2 create-transit-gateway-route \\
  --transit-gateway-route-table-id tgw-rtb-0abc \\
  --destination-cidr-block 10.2.0.0/16 \\
  --transit-gateway-attachment-id tgw-attach-shared
\`\`\`

### VPC PrivateLink – Expose a Service Privately

\`\`\`mermaid
flowchart LR
    CONSUMER[Consumer VPC\nApplication] -->|DNS resolves to\nprivate IP| ENI[ENI in Consumer VPC\nInterface Endpoint]
    ENI -->|PrivateLink\nno internet| NLB[NLB in Provider VPC]
    NLB --> SVC[Your Service\nProviders VPC]
\`\`\`

\`\`\`bash
# Provider: Create endpoint service from NLB
aws ec2 create-vpc-endpoint-service-configuration \\
  --network-load-balancer-arns arn:aws:elasticloadbalancing:...nlb

# Consumer: Create interface endpoint
aws ec2 create-vpc-endpoint \\
  --vpc-id vpc-consumer \\
  --service-name com.amazonaws.vpce.us-east-1.vpce-svc-0abc \\
  --vpc-endpoint-type Interface \\
  --subnet-ids subnet-0abc \\
  --private-dns-enabled  # Critical for transparent DNS resolution
\`\`\`

### VPC Flow Logs → Athena Security Analysis

\`\`\`sql
-- Find top source IPs attempting blocked traffic
SELECT srcaddr, COUNT(*) as rejected_attempts
FROM vpc_flow_logs
WHERE action = 'REJECT'
  AND day BETWEEN '2025-02-01' AND '2025-02-25'
GROUP BY srcaddr
ORDER BY rejected_attempts DESC
LIMIT 10;
\`\`\``
  },
  {
    title: 'Amazon Route 53 – DNS, Health Checks & Traffic Routing Policies',
    skillLevel: 'intermediate', timeToPracticeMins: 45,
    tldr: 'Route 53 provides DNS with 7 routing policies: Simple, Weighted, Latency, Failover, Geolocation, Geoproximity, and Multi-Value. Health checks enable automatic failover.',
    beginnerSummary: 'Route 53 is AWS\'s DNS service — it translates domain names like example.com into IP addresses. It also routes traffic intelligently: send users to the nearest server, or failover when a server is down.',
    proSummary: 'Route 53 Resolver endpoints bridge on-prem DNS with AWS VPCs. Traffic Flow visual editor chains routing policies. Health checks support string matching on HTTP responses. DNSSEC signing prevents DNS spoofing.',
    whyMatters: 'DNS is the first step for every user request. Wrong routing means latency, outages, or split traffic during deployments. Route 53 enables blue/green and canary deployments at DNS level.',
    commonMistakes: 'Setting TTL too high before migrations (changes take hours to propagate). Not enabling health checks on failover routing (defeats the purpose). Using Simple routing when you need health checks.',
    nextTopicTitle: 'CloudFront', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## Amazon Route 53 – DNS & Traffic Management

> 📚 [Route 53 Routing Policies](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html) | [Health Checks](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover.html)

### Routing Policies Cheat Sheet

| Policy | Use Case | Health Checks |
|---|---|---|
| **Simple** | Single resource | ❌ |
| **Weighted** | A/B testing, gradual migration | ✅ |
| **Latency** | Route to lowest-latency region | ✅ |
| **Failover** | Active-passive DR | ✅ (required) |
| **Geolocation** | GDPR data residency, localization | ✅ |
| **Geoproximity** | Weighted by geographic bias | ✅ |
| **Multi-Value** | Random from healthy IPs (not a load balancer) | ✅ |

### 🟢 Weighted Routing – Canary Deployment

\`\`\`mermaid
flowchart LR
    DNS[Route 53\napi.example.com] -->|90% traffic| V1[ALB v1.0\nus-east-1]
    DNS -->|10% traffic| V2[ALB v2.0-beta\nus-east-1]
\`\`\`

\`\`\`bash
# v1 gets weight 90, v2 gets weight 10
aws route53 change-resource-record-sets --hosted-zone-id Z123 \\
  --change-batch '{
    "Changes": [
      {"Action": "UPSERT", "ResourceRecordSet": {
        "Name": "api.example.com", "Type": "A",
        "SetIdentifier": "v1", "Weight": 90,
        "AliasTarget": {"DNSName": "alb-v1.us-east-1.elb.amazonaws.com", "EvaluateTargetHealth": true, "HostedZoneId": "Z35SXDOTRQ7X7K"}
      }},
      {"Action": "UPSERT", "ResourceRecordSet": {
        "Name": "api.example.com", "Type": "A",
        "SetIdentifier": "v2", "Weight": 10,
        "AliasTarget": {"DNSName": "alb-v2.us-east-1.elb.amazonaws.com", "EvaluateTargetHealth": true, "HostedZoneId": "Z35SXDOTRQ7X7K"}
      }}
    ]
  }'
\`\`\`

### 🔴 Failover Routing – Active/Passive DR

\`\`\`bash
# Primary health check
aws route53 create-health-check --caller-reference 2025-check \\
  --health-check-config '{
    "Type": "HTTPS",
    "FullyQualifiedDomainName": "app.example.com",
    "Port": 443,
    "ResourcePath": "/health",
    "RequestInterval": 10,
    "FailureThreshold": 2
  }'

# Primary record
aws route53 change-resource-record-sets --hosted-zone-id Z123 \\
  --change-batch '{"Changes": [{"Action": "UPSERT", "ResourceRecordSet": {
    "Name": "app.example.com", "Type": "A",
    "SetIdentifier": "primary", "Failover": "PRIMARY",
    "HealthCheckId": "hc-0abc",
    "AliasTarget": {"DNSName": "us-east-1-alb...", ...}
  }}]}'
# Repeat with "SECONDARY" and DR region ALB — failover happens in <60s
\`\`\``
  },
  {
    title: 'Amazon CloudFront – Global CDN, Edge Functions & Security',
    skillLevel: 'intermediate', timeToPracticeMins: 40,
    tldr: 'CloudFront delivers content from 450+ PoPs worldwide. Cache S3 and ALB origins, run logic at the edge with CloudFront Functions/Lambda@Edge, and block attacks with WAF.',
    beginnerSummary: 'CloudFront caches your website and APIs at servers near your users worldwide, making pages load faster and protecting your origin from traffic spikes.',
    proSummary: 'Cache behaviors control per-path TTL and origin routing. Origin Shield reduces origin load. CloudFront Functions (JS, sub-ms) vs Lambda@Edge (Node.js/Python, 1-5ms) — use Functions for simple request manipulation, Lambda@Edge for auth and A/B testing.',
    whyMatters: 'CloudFront transforms a slow origin into a fast global service. A cached S3 static site behind CloudFront costs $0.008/GB vs $0.085/GB directly, while adding DDoS protection (Shield Standard) for free.',
    commonMistakes: 'Not setting correct Cache-Control headers on origin (defaults to no caching). Caching POST requests. Forgetting to invalidate cache after deployments. Not using Origin Shield for multi-region origins.',
    nextTopicTitle: 'API Gateway', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## Amazon CloudFront – Global CDN

> 📚 [CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/) | [CloudFront Functions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-functions.html)

### CloudFront Architecture

\`\`\`mermaid
flowchart LR
    USER[User\nSydney] -->|1. DNS → nearest PoP| CF[CloudFront PoP\nSydney]
    CF -->|2. Cache HIT| USER
    CF -->|2. Cache MISS → fetch| OS[Origin Shield\nSingapore]
    OS -->|Cache HIT| CF
    OS -->|Cache MISS| ORIGIN[ALB Origin\nus-east-1]
\`\`\`

### 🟢 Beginner: S3 Static Website with CloudFront

\`\`\`bash
# Create distribution
aws cloudfront create-distribution --distribution-config '{
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "s3-origin",
      "DomainName": "mybucket.s3.us-east-1.amazonaws.com",
      "S3OriginConfig": {"OriginAccessIdentity": "origin-access-identity/cloudfront/ABCDEF"}
    }]
  },
  "DefaultCacheBehavior": {
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true,
    "TargetOriginId": "s3-origin"
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100",
  "DefaultRootObject": "index.html"
}'
\`\`\`

### 🟡 Cache Behaviors (per-path routing)

| Path | Origin | TTL | Notes |
|---|---|---|---|
| /static/* | S3 | 1 year | Immutable assets |
| /api/* | ALB | 0 | Never cache API |
| /images/* | S3 | 7 days | Origin Shield on |
| / | S3 | 5 min | index.html |

### 🔴 CloudFront Function – Rewrite URL at Edge

\`\`\`javascript
// Runs in <1ms at ALL 450+ PoPs — no Lambda coldstart
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // /blog/my-post → /blog/my-post/index.html (SPA routing)
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }

    // Add security headers on every request
    request.headers['x-content-type-options'] = [{value: 'nosniff'}];

    return request;
}
\`\`\`

### Invalidation after deployment

\`\`\`bash
aws cloudfront create-invalidation \\
  --distribution-id EABCDEF \\
  --paths "/*"   # Invalidate all — use "/\${version}/*" for granular control
\`\`\``
  },
  {
    title: 'Amazon API Gateway – REST, HTTP & WebSocket APIs at Scale',
    skillLevel: 'intermediate', timeToPracticeMins: 50,
    tldr: 'API Gateway provides managed REST, HTTP v2, and WebSocket APIs. HTTP API is 70% cheaper than REST API. Use REST for legacy features (throttling, caching, request validation).',
    beginnerSummary: 'API Gateway sits in front of your Lambda functions or services and turns them into proper HTTP APIs with authentication, rate limiting, and automatic scaling.',
    proSummary: 'REST API: per-method throttling, caching, request/response transformation with mapping templates, custom authorizers with caching. HTTP API v2: JWT authorizers, automatic CORS, Lambda proxy only — no mapping templates. WebSocket API: two-way persistent connections with $connect/$disconnect/$default routes.',
    whyMatters: 'Without API Gateway, your Lambda functions need their own HTTP handling, rate limiting, auth, and SSL. API Gateway provides these instantly for any scale.',
    commonMistakes: 'Using REST API when HTTP API suffices (3-4× more expensive). Not enabling Access Logging (blind to request patterns). Forgetting to deploy after changes (changes aren\'t live until deployed to a stage).',
    nextTopicTitle: 'Application Load Balancer', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## Amazon API Gateway – Managed APIs

> 📚 [API Gateway REST](https://docs.aws.amazon.com/apigateway/latest/developerguide/) | [HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html) | [WebSocket API](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html)

### REST vs HTTP API Comparison

| Feature | REST API | HTTP API |
|---|---|---|
| Price | $3.50/M | $1.00/M |
| Lambda proxy | ✅ | ✅ |
| Custom integrations | ✅ | ❌ |
| Request validation | ✅ | ❌ |
| Caching | ✅ | ❌ |
| Usage plans & API keys | ✅ | ❌ |
| JWT authorizer | ❌ | ✅ |
| OIDC/OAuth | ❌ | ✅ built-in |

### 🟢 HTTP API with JWT Auth and Lambda

\`\`\`bash
aws apigatewayv2 create-api \\
  --name orders-api \\
  --protocol-type HTTP \\
  --cors-configuration '{"AllowOrigins":["*"],"AllowMethods":["GET","POST"]}'

# JWT authorizer (Cognito or any OIDC provider)
aws apigatewayv2 create-authorizer \\
  --api-id abc123 \\
  --authorizer-type JWT \\
  --identity-source '$request.header.Authorization' \\
  --jwt-configuration '{
    "Audience": ["my-app-client-id"],
    "Issuer": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_abc"
  }'
\`\`\`

### 🟡 REST API Architecture with Caching

\`\`\`mermaid
flowchart LR
    CLIENT[Mobile App] -->|HTTPS + API Key| APIGW[API Gateway REST\nThrottle: 1000 rps]
    APIGW -->|Cache HIT| CACHE[API Gateway Cache\nTTL 300s]
    APIGW -->|Cache MISS| AUTH[Custom Authorizer\nCached 300s]
    AUTH -->|JWT validated| LAMBDA[Lambda\nBusiness Logic]
    LAMBDA --> DDB[DynamoDB]
\`\`\`

### 🔴 WebSocket API – Real-Time Chat/Notifications

\`\`\`javascript
// Lambda handling WebSocket $connect
exports.handler = async (event) => {
  const { connectionId, domainName, stage } = event.requestContext;

  // Store connection in DynamoDB
  await ddb.put({ TableName: 'connections', Item: {
    connectionId, userId: event.queryStringParameters.userId,
    ttl: Math.floor(Date.now()/1000) + 7200   // 2hr TTL
  }}).promise();

  return { statusCode: 200 };
};

// Send message to specific connection
const apigw = new ApiGatewayManagementApi({
  endpoint: \`\${domainName}/\${stage}\`
});
await apigw.postToConnection({
  ConnectionId: targetConnectionId,
  Data: JSON.stringify({ type: 'chat', message: 'Hello!' })
}).promise();
\`\`\``
  },
  {
    title: 'Application Load Balancer – Layer 7 Routing, Target Groups & mTLS',
    skillLevel: 'intermediate', timeToPracticeMins: 45,
    tldr: 'ALB routes HTTP/HTTPS traffic intelligently using host-based, path-based, query-string, and header rules. Supports Lambda, ECS, EKS, EC2, and IP targets.',
    beginnerSummary: 'ALB is a smart traffic distributor. It reads your HTTP requests and sends them to different servers based on the URL path, hostname, or headers — all without any application code change.',
    proSummary: 'ALB listener rules evaluated in priority order (1=highest). Weighted target groups enable A/B testing. Lambda targets bypass VPC networking. ALB access logs → S3 → Athena for traffic analysis. mTLS (mutual authentication) for zero-trust service mesh.',
    whyMatters: 'ALB is the entry point for containerized microservices. Path-based routing lets one ALB serve dozens of microservices on a single IP, reducing cost and complexity.',
    commonMistakes: 'Not setting deregistration delay (connections drop during deployments). Using ALB instead of NLB for non-HTTP protocols. Not enabling access logs (blind to traffic patterns and issues).',
    nextTopicTitle: 'AWS IAM Advanced', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
    content: `## Application Load Balancer – Layer 7 Routing

> 📚 [ALB User Guide](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/) | [Listener Rules](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-update-rules.html)

### ALB vs NLB vs GWLB

| Feature | ALB | NLB | GWLB |
|---|---|---|---|
| Layer | 7 (HTTP/HTTPS/gRPC) | 4 (TCP/UDP/TLS) | 3 (inline inspection) |
| Health checks | HTTP | TCP/HTTP | HTTP |
| Static IP | ❌ (use Global Accelerator) | ✅ | N/A |
| WebSocket | ✅ | ✅ | N/A |
| Use case | Web apps, microservices | Low-latency TCP, gaming | Firewall appliances |

### Microservices: Path-Based Routing

\`\`\`mermaid
flowchart LR
    USER[User Request] --> ALB[ALB\napp.example.com]
    ALB -->|/api/orders/*| TG1[Orders Service\nECS Tasks]
    ALB -->|/api/users/*| TG2[Users Service\nECS Tasks]
    ALB -->|/api/products/*| TG3[Products Service\nECS Tasks]
    ALB -->|/* default| TG4[Frontend\nS3 via Lambda]
\`\`\`

\`\`\`bash
# Create listener rule for /api/orders/*
aws elbv2 create-rule \\
  --listener-arn arn:aws:elasticloadbalancing:...listener \\
  --priority 10 \\
  --conditions '[{"Field":"path-pattern","Values":["/api/orders/*"]}]' \\
  --actions '[{"Type":"forward","TargetGroupArn":"arn:...orders-tg"}]'
\`\`\`

### Weighted Target Groups (A/B / Canary)

\`\`\`bash
aws elbv2 create-rule \\
  --listener-arn arn:... \\
  --priority 5 \\
  --conditions '[{"Field":"path-pattern","Values":["/api/checkout/*"]}]' \\
  --actions '[{
    "Type": "forward",
    "ForwardConfig": {
      "TargetGroups": [
        {"TargetGroupArn": "arn:...checkout-v1", "Weight": 90},
        {"TargetGroupArn": "arn:...checkout-v2", "Weight": 10}
      ],
      "StickinessConfig": {"Enabled": true, "DurationSeconds": 3600}
    }
  }]'
\`\`\`

### Health Check Best Practices

\`\`\`bash
aws elbv2 modify-target-group \\
  --target-group-arn arn:... \\
  --health-check-protocol HTTP \\
  --health-check-path /health \\
  --health-check-interval-seconds 10 \\
  --healthy-threshold-count 2 \\
  --unhealthy-threshold-count 2 \\
  --matcher '{"HttpCode": "200"}'
# Reduce interval to 10s + threshold to 2 for faster failover during deployments
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
