// seed_batch5.mjs — Databases: RDS + Aurora + DynamoDB Advanced + ElastiCache + DocumentDB
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch5.mjs
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
        title: 'Amazon RDS – Managed Relational Databases on AWS',
        skillLevel: 'intermediate', timeToPracticeMins: 50,
        tldr: 'RDS manages MySQL, PostgreSQL, Oracle, SQL Server, and MariaDB — patching, backups, Multi-AZ failover, and read replicas all included. You focus on queries, not servers.',
        beginnerSummary: 'RDS is a managed database service. You pick your database engine and size, and AWS handles server setup, updates, and daily backups automatically.',
        proSummary: 'Multi-AZ uses synchronous replication (RPO=0, RTO=1-2min). Read Replicas use async replication — not for HA, for read scaling. RDS Proxy pools connections from Lambda (prevents connection exhaustion at scale). Enhanced Monitoring provides OS-level metrics at 1-second granularity.',
        whyMatters: 'Running database servers manually means 24/7 patching, backup testing, and failover maintenance. RDS eliminates this entirely — your DBA time goes from operations to optimization.',
        commonMistakes: 'Confusing Multi-AZ (HA) with Read Replicas (read scaling). Not using RDS Proxy with Lambda (thousands of connections crash the DB). Using db.t3.micro for production (burstable CPU causes throttling).',
        nextTopicTitle: 'Amazon Aurora', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon RDS – Relational Database Service

> 📚 [RDS User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/) | [RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)

### Supported Engines
- **MySQL** 8.0, 5.7 | **PostgreSQL** 16, 15, 14, 13 | **MariaDB** 10.x  
- **Oracle** EE/SE2 | **Microsoft SQL Server** 2022/2019 | **Db2** (new 2024)

### Multi-AZ vs Read Replica vs RDS Proxy

\`\`\`mermaid
flowchart LR
    APP[Application] --> PROXY[RDS Proxy\nConnection Pooling]
    PROXY --> PRI[RDS Primary\nWrite + Read]
    PRI -->|Sync replication\nRPO=0| STANDBY[Multi-AZ Standby\nAuto-failover 1-2min]
    PRI -->|Async replication\nRead scaling| RR1[Read Replica\nus-east-1b]
    PRI -->|Cross-region async| RR2[Read Replica\nus-west-2 DR]
\`\`\`

### 🟢 Create a Multi-AZ RDS PostgreSQL

\`\`\`bash
aws rds create-db-instance \\
  --db-instance-identifier prod-postgres \\
  --db-instance-class db.r7g.xlarge \\
  --engine postgres \\
  --engine-version 16.2 \\
  --master-username admin \\
  --master-user-password "$(aws secretsmanager get-secret-value --secret-id prod/rds/password --query SecretString --output text)" \\
  --multi-az \\
  --storage-type gp3 \\
  --allocated-storage 500 \\
  --iops 12000 \\
  --storage-encrypted \\
  --kms-key-id arn:aws:kms:us-east-1:123:key/abc \\
  --backup-retention-period 35 \\
  --deletion-protection
\`\`\`

### RDS Proxy – Essential for Lambda

\`\`\`bash
aws rds create-db-proxy \\
  --db-proxy-name lambda-rds-proxy \\
  --engine-family POSTGRESQL \\
  --auth '[{"AuthScheme":"SECRETS","SecretArn":"arn:aws:secretsmanager:...","IAMAuth":"REQUIRED"}]' \\
  --role-arn arn:aws:iam::123:role/rds-proxy-role \\
  --vpc-subnet-ids subnet-a subnet-b
# Lambda connects to Proxy endpoint (not directly to DB)
# Proxy multiplexes 10,000 Lambda connections into ~100 DB connections
\`\`\`

### Performance Insights – Query-Level Monitoring

\`\`\`bash
# Enable Performance Insights (free for 7 days retention)
aws rds modify-db-instance \\
  --db-instance-identifier prod-postgres \\
  --enable-performance-insights \\
  --performance-insights-retention-period 731

# Query top SQL by wait time
aws pi get-resource-metrics --service-type RDS \\
  --identifier db-ABCDEF \\
  --metric-queries '[{"Metric":"db.sql.calls","GroupBy":{"Group":"db.sql","Limit":5}}]' \\
  --start-time 2025-02-25T00:00:00Z --end-time 2025-02-25T23:59:59Z --period-in-seconds 3600
\`\`\``
    },
    {
        title: 'Amazon Aurora – Cloud-Native Relational Database at Scale',
        skillLevel: 'advanced', timeToPracticeMins: 60,
        tldr: 'Aurora is MySQL/PostgreSQL-compatible and 5×/3× faster. Storage auto-scales to 128 TB, replicates across 3 AZs with 6 copies, and Serverless v2 scales to 0 per second.',
        beginnerSummary: 'Aurora is AWS\'s own database engine — compatible with MySQL and PostgreSQL but reengineered for the cloud. It\'s faster, more durable, and can scale up or down automatically.',
        proSummary: 'Aurora storage: 6 copies across 3 AZs using quorum writes (4/6 needed). Parallel Query pushes computation into the storage layer. Aurora Global Database provides cross-region replication with <1s lag. Aurora Serverless v2 scales in 0.5 ACU increments in <1 second — ideal for bursty workloads.',
        whyMatters: 'Aurora Global Database is the closest thing to zero-RPO, zero-RTO multi-region databases AWS offers. For SaaS using per-tenant databases, Aurora Serverless v2 eliminates over-provisioning costs by 80%.',
        commonMistakes: 'Using Aurora Serverless v2 for steady-high-traffic workloads (provisioned is cheaper). Not testing with Aurora write forwarding from replicas. Forgetting that Aurora storage is charged separately from instance compute.',
        nextTopicTitle: 'Amazon DynamoDB Advanced', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon Aurora – Cloud-Native Database

> 📚 [Aurora User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/) | [Aurora Serverless v2](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html) | [Global Database](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html)

### Aurora vs RDS Comparison

| Feature | RDS MySQL | Aurora MySQL |
|---|---|---|
| Storage replication | 1 copy (Multi-AZ = 2) | 6 copies across 3 AZs |
| Read replicas | Up to 5 | Up to 15, read endpoint auto-balances |
| Failover time | 1-2 min | <30 seconds |
| Max storage | 64 TB | 128 TB (auto-scales) |
| Cross-region DR | Read Replica (manual promote) | Global Database (<1s lag, <1min failover) |
| Serverless | ❌ | ✅ v2 (scales per second) |

### Aurora Global Database – Multi-Region Active/Passive

\`\`\`mermaid
flowchart LR
    US_APP[US App\nus-east-1] -->|Writes| US_DB[Aurora Primary\nCluster us-east-1]
    US_DB -->|Async replication\n<1s lag| EU_DB[Aurora Secondary\nCluster eu-west-1]
    EU_APP[EU App\neu-west-1] -->|Reads| EU_DB
    EU_DB -.->|Failover: promote to primary\n<1 min RTO, ~1s RPO| EU_APP
\`\`\`

\`\`\`bash
# Create global database
aws rds create-global-cluster \\
  --global-cluster-identifier my-global-db \\
  --source-db-cluster-identifier arn:aws:rds:us-east-1:123:cluster:prod

# Add secondary region
aws rds create-db-cluster \\
  --db-cluster-identifier prod-replica-eu \\
  --global-cluster-identifier my-global-db \\
  --engine aurora-postgresql \\
  --region eu-west-1
\`\`\`

### Aurora Serverless v2 – Scale from 0.5 to 128 ACUs

\`\`\`bash
aws rds modify-db-cluster \\
  --db-cluster-identifier prod-cluster \\
  --serverless-v2-scaling-configuration '{"MinCapacity": 0.5, "MaxCapacity": 64}'
# 0.5 ACU = 0.5 vCPU, 1 GB RAM ($0.12/ACU-hr)
# 64 ACU = 64 vCPU, 128 GB RAM
# Scales in ~1 second, charged per second of usage
\`\`\`

### Aurora I/O-Optimized (2023) — Eliminate Storage I/O Costs

\`\`\`text
Standard Aurora: Compute + Storage + I/O ($0.20/million I/O requests)
I/O-Optimized:   Compute + Storage only (no I/O charge, storage 25% higher)

Break-even: When I/O cost > 25% of total Aurora bill → switch to I/O-Optimized
Typical for: High-transaction OLTP databases, gaming leaderboards, fraud detection
\`\`\``
    },
    {
        title: 'Amazon DynamoDB Advanced – GSIs, DynamoDB Streams & DAX',
        skillLevel: 'advanced', timeToPracticeMins: 75,
        tldr: 'Advanced DynamoDB: design GSIs for alternate access patterns, use Streams for event-driven triggers, and DAX for microsecond caching of read-heavy workloads.',
        beginnerSummary: 'Advanced DynamoDB lets you query data in different ways with Global Secondary Indexes, react to changes in real-time with Streams, and serve millions of reads per second with DAX cache.',
        proSummary: 'GSI = separate copy of data with different PK — 20 GSI limit, eventual consistent only. DynamoDB Streams: shard iterator gives ordered per-partition delivery to Lambda ESM. DAX: write-through, item cache and query cache with TTL. On-demand vs Provisioned: on-demand is ~6x more expensive at sustained load.',
        whyMatters: 'Most DynamoDB performance issues and wasted costs come from poor data modeling. GSIs and single-table design are the skills that separate 100ms and 1ms DynamoDB responses.',
        commonMistakes: 'Creating a DynamoDB table with the same schema as a relational DB (no single-table design). Using Scan instead of Query. Not using sparse indexes. Creating hot partitions by using timestamps as partition keys.',
        nextTopicTitle: 'Amazon ElastiCache', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon DynamoDB Advanced

> 📚 [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html) | [GSIs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html) | [DAX](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DAX.html)

### Single-Table Design Pattern

\`\`\`text
Table: ecommerce

PK              | SK                  | GSI1PK          | GSI1SK       | Attributes
----------------|---------------------|-----------------|--------------|----------
USER#u001       | PROFILE             | EMAIL#john@...  | USER#u001    | name, email
USER#u001       | ORDER#o2025-001     | STATUS#PENDING  | 2025-02-25   | total, items
USER#u001       | ORDER#o2025-002     | STATUS#SHIPPED  | 2025-02-24   | total, items
PRODUCT#p001    | DETAILS             | CAT#electronics | p001         | name, price
ORDER#o2025-001 | ITEM#PRODUCT#p001   |                 |              | qty, price

Access patterns:
- Get user profile → PK=USER#u001, SK=PROFILE
- Get all user orders → PK=USER#u001, SK begins_with ORDER#
- Get all PENDING orders (admin) → GSI1: GSI1PK=STATUS#PENDING
\`\`\`

### Global Secondary Index

\`\`\`bash
aws dynamodb update-table \\
  --table-name ecommerce \\
  --attribute-definitions AttributeName=GSI1PK,AttributeType=S AttributeName=GSI1SK,AttributeType=S \\
  --global-secondary-index-updates '[{
    "Create": {
      "IndexName": "GSI1",
      "KeySchema": [
        {"AttributeName": "GSI1PK", "KeyType": "HASH"},
        {"AttributeName": "GSI1SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"},
      "BillingMode": "PAY_PER_REQUEST"
    }
  }]'
\`\`\`

### DynamoDB Streams + Lambda – Event-Driven Architecture

\`\`\`mermaid
flowchart LR
    APP[Application] -->|PutItem / UpdateItem| DDB[DynamoDB Table]
    DDB -->|Change stream KEYS_AND_NEW_IMAGE| STREAM[DynamoDB Stream]
    STREAM -->|Lambda ESM\nbatch 100 records| LAMBDA[Lambda Processor]
    LAMBDA -->|Index new record| OS[OpenSearch]
    LAMBDA -->|Notify user| SNS[SNS]
\`\`\`

\`\`\`javascript
exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const newItem = record.dynamodb.NewImage;
      // Index in OpenSearch for full-text search
      await indexDocument(unmarshall(newItem));
    }
    if (record.eventName === 'MODIFY') {
      // Detect status changes
      const old = record.dynamodb.OldImage;
      const neu = record.dynamodb.NewImage;
      if (old?.status?.S !== neu?.status?.S) {
        await sendStatusNotification(unmarshall(neu));
      }
    }
  }
};
\`\`\`

### DAX – Microsecond Cache for DynamoDB

\`\`\`text
Without DAX: DynamoDB → 1-10ms single-digit ms reads
With DAX:    DAX → 35-100 microsecond reads (cache hit)

Cost-effective when: >80% reads, <200ms latency required, hot items repeatedly queried
Not suitable for: Write-heavy workloads, strongly consistent reads, all-unique queries
\`\`\``
    },
    {
        title: 'Amazon ElastiCache – Redis & Memcached for Sub-Millisecond Performance',
        skillLevel: 'intermediate', timeToPracticeMins: 45,
        tldr: 'ElastiCache provides managed Redis and Memcached. Redis supports pub/sub, sorted sets, streams, and persistence. Use it for sessions, leaderboards, rate limiting, and database query caching.',
        beginnerSummary: 'ElastiCache is a super-fast in-memory cache layer you put in front of your database. Instead of hitting the DB on every request, your app checks the cache first and gets data in under a millisecond.',
        proSummary: 'Redis cluster mode: data sharded across 1-500 shards. Each shard = 1 primary + 0-5 replicas. Local zones support for ultra-low latency. ElastiCache Serverless auto-scales based on utilization. Redis vs Memcached: Redis always for new applications (richer data types, persistence, replication).',
        whyMatters: 'A PostgreSQL query takes 5-50ms. The same data from ElastiCache takes 0.1-0.5ms. For high-traffic APIs serving millions of users, this difference determines whether your architecture holds or collapses under load.',
        commonMistakes: 'Using Memcached when you need persistence (use Redis). Not using connection pooling (each Redis connection costs memory). Setting TTLs too long (stale data served) or too short (cache stampede on expiry).',
        nextTopicTitle: 'Amazon DocumentDB', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon ElastiCache – In-Memory Caching

> 📚 [ElastiCache for Redis](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/) | [Caching Strategies](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/Strategies.html)

### Redis vs Memcached

| Feature | Redis | Memcached |
|---|---|---|
| Data types | String, Hash, List, Set, Sorted Set, Stream | String only |
| Persistence | ✅ RDB + AOF | ❌ |
| Replication | ✅ Primary/Replica | ❌ |
| Pub/Sub | ✅ | ❌ |
| Clustering | ✅ (up to 500 shards) | ✅ (simple sharding) |
| Choose when | Almost always | Pure simple cache, multi-threaded perf |

### Common Caching Patterns

\`\`\`mermaid
flowchart LR
    APP[Application] -->|GET user:123| CACHE[ElastiCache Redis]
    CACHE -->|Cache HIT| APP
    CACHE -->|Cache MISS| DB[RDS PostgreSQL]
    DB -->|Data| CACHE
    CACHE -->|SET user:123 TTL=300s| CACHE
    CACHE -->|Data| APP
\`\`\`

### Cache-Aside Pattern (Lazy Loading) in Python

\`\`\`python
import redis, json, hashlib
from functools import wraps

r = redis.Redis(host='my-cluster.cache.amazonaws.com', port=6379, ssl=True)

def cached(ttl=300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{hashlib.md5(str(args).encode()).hexdigest()}"
            cached_value = r.get(key)
            if cached_value:
                return json.loads(cached_value)
            result = await func(*args, **kwargs)
            r.setex(key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

@cached(ttl=300)
async def get_user_profile(user_id: str):
    return await db.query("SELECT * FROM users WHERE id = %s", [user_id])
\`\`\`

### Redis Sorted Sets – Real-Time Leaderboard

\`\`\`python
# Add/update player score
r.zadd('leaderboard:global', {'player:alice': 98500})
r.zadd('leaderboard:global', {'player:bob': 85000})

# Get top 10 players (descending)
top10 = r.zrevrange('leaderboard:global', 0, 9, withscores=True)
# [('player:alice', 98500.0), ('player:bob', 85000.0), ...]

# Get a player's rank
rank = r.zrevrank('leaderboard:global', 'player:alice')  # 0-indexed

# Atomic increment
r.zincrby('leaderboard:global', 1500, 'player:alice')  # thread-safe
\`\`\`

### Rate Limiting with Redis (Token Bucket)

\`\`\`python
def is_allowed(user_id: str, limit: int = 100, window: int = 60) -> bool:
    key = f"ratelimit:{user_id}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, window)  # Set TTL on first request
    return count <= limit
\`\`\``
    },
    {
        title: 'Amazon DocumentDB – MongoDB-Compatible Managed Document Database',
        skillLevel: 'intermediate', timeToPracticeMins: 40,
        tldr: 'DocumentDB is a MongoDB-compatible document database fully managed by AWS. Stores JSON documents, scales to millions of reads/writes, and replicates across 3 AZs automatically.',
        beginnerSummary: 'DocumentDB stores flexible JSON data — perfect when your data structure varies between records (like product catalogs or user profiles). It works with existing MongoDB drivers without code changes.',
        proSummary: 'DocumentDB uses Aurora\'s distributed storage (6 copies, 3 AZs). Compute and storage scale independently. Change Streams power event-driven pipelines. Amazon DocumentDB Elastic Clusters (2023) auto-shard collections horizontally for multi-million TPS.',
        whyMatters: 'If you\'re already using MongoDB on-prem, DocumentDB provides a migration path to fully managed with zero driver changes. Aurora-based storage means automatic 6-way replication with no replica lag management.',
        commonMistakes: 'Assuming 100% MongoDB API compatibility (some operators unsupported — check compatibility guide). Not using Connection Pooling (DocumentDB is connection-limited per instance). Using DocumentDB for ACID multi-document transactions across shards (use RDS instead).',
        nextTopicTitle: 'Amazon ECS', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon DocumentDB – Managed Document Database

> 📚 [DocumentDB User Guide](https://docs.aws.amazon.com/documentdb/latest/developerguide/) | [MongoDB Compatibility](https://docs.aws.amazon.com/documentdb/latest/developerguide/mongo-apis.html)

### DocumentDB Architecture (Aurora Storage)

\`\`\`mermaid
flowchart LR
    APP[Application\nMongoDB Driver] --> PRI[DocumentDB Primary\nInstance]
    PRI --> REP1[Read Replica 1]
    PRI --> REP2[Read Replica 2]
    PRI -->|6 copies across 3 AZs| STOR[Distributed Storage\n10 GB → 64 TB auto-scale]
    REP1 --> STOR
    REP2 --> STOR
\`\`\`

### Create a DocumentDB Cluster

\`\`\`bash
# Create cluster
aws docdb create-db-cluster \\
  --db-cluster-identifier prod-docdb \\
  --engine docdb \\
  --engine-version 5.0.0 \\
  --master-username admin \\
  --master-user-password 'MySecret@2025' \\
  --storage-encrypted \\
  --deletion-protection

# Add primary instance
aws docdb create-db-instance \\
  --db-cluster-identifier prod-docdb \\
  --db-instance-identifier prod-docdb-primary \\
  --db-instance-class db.r7g.xlarge \\
  --engine docdb
\`\`\`

### Insert and Query JSON Documents

\`\`\`javascript
const { MongoClient } = require('mongodb');

const client = new MongoClient(
  'mongodb://admin:pass@prod-docdb.cluster-xyz.us-east-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=rds-combined-ca-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred'
);

const db = client.db('ecommerce');
const products = db.collection('products');

// Insert a flexible document
await products.insertOne({
  _id: 'PROD-001',
  name: 'AWS Certified Developer Study Guide',
  category: 'Books',
  price: 49.99,
  tags: ['aws', 'certification', 'cloud'],
  specs: { pages: 450, format: 'PDF+ePub', updated: '2025-02' },
  reviews: [
    { user: 'alice', rating: 5, text: 'Excellent!' },
    { user: 'bob',   rating: 4, text: 'Very helpful' }
  ]
});

// Rich query with nested document filtering
const awsBooks = await products.find({
  category: 'Books',
  'tags': 'aws',
  'specs.pages': { $gt: 300 },
  price: { $lte: 60 }
}).sort({ price: 1 }).limit(10).toArray();
\`\`\`

### ElasticClusters – Horizontal Sharding (2023+)

\`\`\`bash
aws docdb create-elastic-cluster \\
  --cluster-name prod-elastic-docdb \\
  --auth-type SECRET_ARN \\
  --secret-arn arn:aws:secretsmanager:... \\
  --shard-count 4 \\       # 4 shards for horizontal distribution
  --shard-instance-count 3  # 3 instances per shard for HA
# Supports millions of writes/second across shards
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
