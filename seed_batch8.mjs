// seed_batch8.mjs — Analytics & ML: Athena + Kinesis + Redshift + QuickSight + SageMaker
// Run: ADMIN_EMAIL=x@x.com ADMIN_PASS=pass node seed_batch8.mjs
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
        title: 'Amazon Athena – Serverless SQL Analytics on S3',
        skillLevel: 'intermediate', timeToPracticeMins: 40,
        tldr: 'Athena runs SQL queries directly on S3 data — no database to provision. Pay $5 per TB scanned. Use Parquet + partitioning to cut costs by 95%.',
        beginnerSummary: 'Athena lets you run SQL on files stored in S3 — CSV, JSON, Parquet, ORC. No servers to manage. You pay only for the data your query reads.',
        proSummary: 'Athena engine v3 (Trino-based): federated query to RDS, DynamoDB, Redshift. ACID transactions via Iceberg table format. Workgroups isolate query cost and control. Result caching avoids re-scanning for repeated identical queries. Athena for Apache Spark: PySpark notebooks on Athena compute.',
        whyMatters: 'A typical BI query on 1 TB of S3 Parquet costs $0.05 with Athena vs $50+ with Redshift for the same result. For ad-hoc analytics and log analysis, Athena is an order of magnitude cheaper.',
        commonMistakes: 'Querying CSV instead of Parquet (5-10× more expensive). Not partitioning (full table scan every query). Not using Athena workgroup query result reuse (same query runs full scan repeatedly).',
        nextTopicTitle: 'Amazon Kinesis', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon Athena – Serverless SQL on S3

> 📚 [Athena User Guide](https://docs.aws.amazon.com/athena/latest/ug/) | [Best Practices](https://docs.aws.amazon.com/athena/latest/ug/performance-tuning.html)

### Cost Optimization: Format vs Partitioning Impact

\`\`\`text
Query: SELECT user_id, COUNT(*) FROM events WHERE date='2025-02-25'

Data Format      | Size Scanned | Cost ($5/TB)
CSV (1 TB)      | 1,000 GB     | $5.00
JSON (1 TB)     | 1,000 GB     | $5.00
Parquet (1 TB)  | 30 GB        | $0.15  ← 33× cheaper
Parquet+Part.   | 1 GB         | $0.005 ← 1000× cheaper
\`\`\`

### Create Table with Partition Projection

\`\`\`sql
CREATE EXTERNAL TABLE cloudfront_logs (
  date             DATE,
  time             STRING,
  location         STRING,
  bytes            BIGINT,
  request_ip       STRING,
  method           STRING,
  host             STRING,
  uri              STRING,
  status           INT,
  referrer         STRING,
  user_agent       STRING
)
PARTITIONED BY (year STRING, month STRING, day STRING)
ROW FORMAT DELIMITED
  FIELDS TERMINATED BY '\\t'
LOCATION 's3://my-logs/cloudfront/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.year.type' = 'integer', 'projection.year.range' = '2024,2026',
  'projection.month.type' = 'integer', 'projection.month.range' = '01,12', 'projection.month.digits'='2',
  'projection.day.type' = 'integer', 'projection.day.range' = '01,31', 'projection.day.digits'='2',
  'storage.location.template' = 's3://my-logs/cloudfront/year=\${year}/month=\${month}/day=\${day}/'
);
\`\`\`

### Analytics Pipeline

\`\`\`mermaid
flowchart LR
    S3[S3 Data Lake\nParquet Partitioned] --> GLUE[Glue Data Catalog\nSchema Registry]
    GLUE --> ATHENA[Athena Queries\nSQL on S3]
    ATHENA --> QS[QuickSight\nDashboards]
    ATHENA --> JUPYTER[SageMaker\nNotebooks]
    ATHENA -->|Federated| RDS[RDS / DynamoDB\nFederated Query]
\`\`\`

### Federated Query – Join S3 + RDS

\`\`\`sql
-- Join S3 data lake with live RDS customer table
SELECT 
    c.customer_name,
    c.tier,
    SUM(e.revenue) as total_revenue
FROM s3_events.purchases e
JOIN postgresql.customers c ON e.customer_id = c.id
WHERE e.year = '2025' AND e.month = '02'
GROUP BY 1, 2
ORDER BY total_revenue DESC
LIMIT 100;
-- Athena handles cross-source join automatically via Lambda connectors
\`\`\``
    },
    {
        title: 'Amazon Kinesis – Real-Time Data Streaming at Any Scale',
        skillLevel: 'advanced', timeToPracticeMins: 60,
        tldr: 'Kinesis Data Streams ingests millions of events/second. Kinesis Data Firehose delivers streams to S3, Redshift, or OpenSearch. Kinesis Data Analytics runs SQL/Apache Flink on live streams.',
        beginnerSummary: 'Kinesis is like a high-speed data highway. Your apps send data (clicks, sensor readings, transactions) to Kinesis at any speed, and downstream systems process it in real time.',
        proSummary: 'KDS: shards = 1 MB/s write, 2 MB/s read. Enhanced fan-out: 2 MB/s per consumer per shard. Firehose buffers by size (1-128 MB) or time (60-900s). Data Analytics Apache Flink: event-time processing with watermarks avoids late-arriving event issues. KPL aggregates batches up to 1 MB for cost efficiency.',
        whyMatters: 'Real-time fraud detection, live dashboards, and instant notifications require stream processing. Kinesis processes data within seconds of arrival — batch ETL jobs take hours.',
        commonMistakes: 'Using too few shards (throttling at 1 MB/s per shard). Using IteratorAge as the only metric (add IncomingBytes, OutgoingBytes). Not enabling enhanced fan-out when multiple consumers need 2 MB/s each.',
        nextTopicTitle: 'Amazon Redshift', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon Kinesis – Real-Time Streaming

> 📚 [Kinesis Data Streams](https://docs.aws.amazon.com/streams/latest/dev/) | [Kinesis Firehose](https://docs.aws.amazon.com/firehose/latest/dev/) | [Managed Flink](https://docs.aws.amazon.com/managed-flink/latest/java/)

### Kinesis Family Overview

| Service | Purpose | Retention | Processing |
|---|---|---|---|
| **Data Streams** | Custom real-time streaming | 24h–365d | Lambda, KCL, Flink |
| **Data Firehose** | Deliver to destinations | Buffer only | Transform Lambda |
| **Data Analytics** | SQL/Flink on streams | Stream only | Managed Flink |
| **Video Streams** | Video ingestion/ML | Configurable | Rekognition |

### Real-Time Architecture

\`\`\`mermaid
flowchart LR
    APP[Apps / IoT\nSensors] -->|PutRecords\nbatch 500 records| KDS[Kinesis Data Streams\n10 shards = 10 MB/s]
    KDS -->|Enhanced Fan-Out\n2 MB/s per consumer| FLINK[Managed Flink\nFraud detection]
    KDS --> FIREHOSE[Kinesis Firehose\nBuffer 5 min, convert to Parquet]
    FIREHOSE --> S3[S3 Data Lake]
    FLINK -->|Fraud alert| DDB[DynamoDB\nBlock transaction]
    FLINK -->|Aggregated metrics| CW[CloudWatch\nDashboard]
\`\`\`

### Produce Records at Scale (KPL)

\`\`\`python
import boto3, json, time

kinesis = boto3.client('kinesis', region_name='us-east-1')
STREAM = 'clickstream'

def send_events(events: list):
    records = [
        {
            'Data': json.dumps(event).encode(),
            'PartitionKey': event['userId']  # Partition by user for ordering per user
        }
        for event in events
    ]
    # Batch up to 500 records per PutRecords call
    for i in range(0, len(records), 500):
        resp = kinesis.put_records(StreamName=STREAM, Records=records[i:i+500])
        if resp['FailedRecordCount'] > 0:
            # Retry failed records with exponential backoff
            pass
\`\`\`

### Managed Flink – Fraud Detection Job

\`\`\`java
// Detect: >5 transactions in 60 seconds from same user
DataStream<Transaction> stream = env.fromSource(kinesisSource, ...);

stream
    .keyBy(Transaction::getUserId)
    .window(SlidingEventTimeWindows.of(Time.seconds(60), Time.seconds(10)))
    .aggregate(new CountAggregate(), new FraudDetector())
    .filter(result -> result.count > 5)
    .addSink(dynamoDbSink);  // Block user in DynamoDB
\`\`\``
    },
    {
        title: 'Amazon Redshift – Cloud Data Warehouse for Petabyte Analytics',
        skillLevel: 'advanced', timeToPracticeMins: 70,
        tldr: 'Redshift is AWS\'s columnar data warehouse delivering 10× better price-performance than on-premises. Serverless auto-scales by RPU. Redshift Spectrum queries S3 without loading data.',
        beginnerSummary: 'Redshift is a massive database optimized for analytics — querying billions of rows across terabytes in seconds. It\'s what BI dashboards and data warehouses use instead of regular databases.',
        proSummary: 'Columnar storage: only reads needed columns. MPP: query distributed across nodes/slices. Redshift Spectrum pushes computation to S3 storage layer. AQUA (Advanced Query Accelerator): hardware-accelerated cache. RA3 nodes: managed storage separate from compute. Materialized views with auto-refresh for frequent dashboard queries.',
        whyMatters: 'A query that takes 30 minutes on PostgreSQL across 1 billion rows takes 2 seconds on Redshift. Redshift Serverless eliminates DBA-level cluster sizing work — it auto-scales in seconds.',
        commonMistakes: 'Not choosing the right sort key and distribution key (kills query performance). Not running VACUUM and ANALYZE regularly (fragmentation degrades over time). Using Redshift for OLTP (use Aurora instead).',
        nextTopicTitle: 'Amazon QuickSight', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon Redshift – Data Warehouse

> 📚 [Redshift Getting Started](https://docs.aws.amazon.com/redshift/latest/gsg/) | [Best Practices](https://docs.aws.amazon.com/redshift/latest/dg/best-practices.html)

### Redshift Architecture

\`\`\`mermaid
flowchart LR
    S3[S3 Data Lake\nCold Data] --> SPECTRUM[Redshift Spectrum\nQuery S3 externally]
    FIREHOSE[Kinesis Firehose] --> COPY[COPY Command\nParallel Load]
    COPY --> LEADER[Leader Node\nQuery Planning]
    LEADER --> SLICE1[Compute Node\nSlice 1-4]
    LEADER --> SLICE2[Compute Node\nSlice 5-8]
    SLICE1 & SLICE2 --> AQUA[AQUA Cache\nHardware Accel NVMe]
    LEADER --> BI[QuickSight / Tableau\nSQL Clients]
\`\`\`

### Serverless Redshift (Zero Management)

\`\`\`bash
aws redshift-serverless create-workgroup \\
  --workgroup-name analytics \\
  --namespace-name prod \\
  --base-capacity 32 \\         # 32 RPUs baseline
  --max-capacity 512 \\         # Auto-scales to 512 RPUs on demand
  --publicly-accessible false

# Query via Data API (no connection pooling needed)
aws redshift-data execute-statement \\
  --workgroup-name analytics \\
  --database analytics_db \\
  --sql "SELECT date_trunc('hour', event_time), COUNT(*) FROM events GROUP BY 1"
\`\`\`

### Design: Table Distribution and Sort Keys

\`\`\`sql
-- Fact table: EVEN distribution avoids data skew
CREATE TABLE fact_sales (
    sale_id      BIGINT,
    product_id   INT,
    customer_id  INT,
    sale_date    DATE,
    amount       DECIMAL(12,2)
)
DISTSTYLE EVEN
SORTKEY (sale_date);  -- Compound sort key for range queries

-- Dimension table: ALL distribution (replicated to every node)
CREATE TABLE dim_products (
    product_id   INT,
    name         VARCHAR(200),
    category     VARCHAR(100),
    price        DECIMAL(10,2)
)
DISTSTYLE ALL;  -- Small dimension tables should be replicated

-- Join: distribution key match eliminates data movement
CREATE TABLE fact_orders (
    order_id     BIGINT,
    customer_id  INT,
    order_date   DATE
)
DISTKEY (customer_id)   -- Match on join key
SORTKEY (order_date);
\`\`\`

### Redshift Spectrum – Query S3 Without Loading

\`\`\`sql
-- Create external schema pointing to Glue catalog
CREATE EXTERNAL SCHEMA spectrum
FROM DATA CATALOG
DATABASE 'analytics'
IAM_ROLE 'arn:aws:iam::123:role/RedshiftSpectrumRole'
CREATE EXTERNAL DATABASE IF NOT EXISTS;

-- Query S3 Parquet + join with Redshift table
SELECT 
    e.user_id,
    c.customer_name,
    COUNT(*) as events
FROM spectrum.clickstream e            -- S3 data via Spectrum
JOIN redshift.customers c ON e.user_id = c.user_id  -- Redshift table
WHERE e.year = '2025' AND e.month = '02'
GROUP BY 1, 2;
\`\`\``
    },
    {
        title: 'Amazon QuickSight – Business Intelligence & ML-Powered Dashboards',
        skillLevel: 'intermediate', timeToPracticeMins: 35,
        tldr: 'QuickSight is AWS\'s serverless BI service. Build interactive dashboards connected to S3, Athena, Redshift, and RDS. ML Insights detects anomalies and forecasts automatically.',
        beginnerSummary: 'QuickSight turns your data into charts and dashboards automatically. Connect it to your data sources, drag and drop metrics, and share live dashboards with your team or customers.',
        proSummary: 'SPICE (in-memory engine): 250 million rows, sub-second queries. Row-Level Security restricts data by user/group (multi-tenant embedding). QuickSight Q: natural language queries ("show me sales by region last quarter"). Embedded analytics: generate embed URLs for customer-facing dashboards. ML Insights: contribution analysis, anomaly detection, time-series forecasting.',
        whyMatters: 'Building BI infrastructure with Grafana, BI servers, and data pipelines takes months. QuickSight connects to Athena in minutes and serves dashboards to 10,000 users at $24/user/year — impossible with traditional BI licensing.',
        commonMistakes: 'Not using SPICE (live queries to Athena on every interaction are slow and expensive). Not enabling row-level security for multi-tenant deployments. Using Standard edition for embedded analytics (Enterprise required).',
        nextTopicTitle: 'Amazon SageMaker', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon QuickSight – Serverless BI

> 📚 [QuickSight User Guide](https://docs.aws.amazon.com/quicksight/latest/user/) | [Embedded Analytics](https://docs.aws.amazon.com/quicksight/latest/user/embedded-analytics.html)

### QuickSight Architecture

\`\`\`mermaid
flowchart LR
    ATHENA[Athena\nS3 Data Lake] --> QS[QuickSight SPICE\nIn-Memory 250M rows]
    REDSHIFT[Redshift\nWarehouse] --> QS
    RDS[RDS / Aurora] --> QS
    QS --> DASH[Dashboards\nReal-time filters]
    QS --> ML[ML Insights\nAnomaly + Forecast]
    QS -->|Embed URL| APP[Customer App\nWhite-label BI]
\`\`\`

### Connect to Athena Data Source

\`\`\`bash
aws quicksight create-data-source \\
  --aws-account-id 123456789 \\
  --data-source-id athena-prod \\
  --name "Production Analytics" \\
  --type ATHENA \\
  --data-source-parameters AthenaParameters={WorkGroup=primary} \\
  --ssl-properties DisableSsl=false
\`\`\`

### Row-Level Security (Multi-Tenant)

\`\`\`json
{
  "DataSetArn": "arn:aws:quicksight:...:dataset/sales",
  "Principals": ["arn:aws:quicksight::user/us-east-1:admin/alice"],
  "ColumnNames": ["region"],
  "RowRules": [{"Username": "alice", "region": "US-EAST"}]
}
\`\`\`
Each user only sees their own region's data in the same dashboard.

### Embedded Dashboard (Customer-Facing BI)

\`\`\`python
import boto3

qs = boto3.client('quicksight', region_name='us-east-1')

def get_embed_url(user_email: str, dashboard_id: str) -> str:
    # Register the user in QuickSight if first time
    try:
        qs.register_user(
            AwsAccountId='123456789',
            Namespace='default',
            Email=user_email,
            IdentityType='QUICKSIGHT',
            QuickSightUserName=user_email,
            UserRole='READER'
        )
    except qs.exceptions.ResourceExistsException:
        pass

    resp = qs.get_dashboard_embed_url(
        AwsAccountId='123456789',
        DashboardId=dashboard_id,
        IdentityType='QUICKSIGHT',
        UserArn=f'arn:aws:quicksight:us-east-1:123456789:user/default/{user_email}',
        SessionLifetimeInMinutes=600
    )
    return resp['EmbedUrl']  # Embed in iframe
\`\`\`

### QuickSight Q – Natural Language Analytics

\`\`\`text
User types: "Show me top 5 states by revenue last quarter"
  ↓ QuickSight Q parses intent
  ↓ Generates: SELECT state, SUM(revenue) FROM sales
                WHERE date >= date_trunc('quarter', NOW()-interval '1 quarter')
                GROUP BY state ORDER BY 2 DESC LIMIT 5
  ↓ Renders: Bar chart automatically
\`\`\``
    },
    {
        title: 'Amazon SageMaker – Build, Train & Deploy ML Models at Scale',
        skillLevel: 'advanced', timeToPracticeMins: 90,
        tldr: 'SageMaker provides a complete ML platform: Studio for development, Training Jobs for distributed GPU training, Model Registry for versioning, and Inference Endpoints for real-time or batch predictions.',
        beginnerSummary: 'SageMaker is AWS\'s end-to-end machine learning platform. Instead of setting up GPU servers and ML infrastructure, you write your model code and SageMaker handles training, testing, and deploying it as an API.',
        proSummary: 'SageMaker Training: spot instances save 70-90% for fault-tolerant jobs (checkpoint to S3). SageMaker Pipelines: MLOps CI/CD for models. Shadow testing compares new model vs production live traffic. Inferentia2 chips (2023): 4× higher throughput, 10× better price-performance vs GPU for inference. SageMaker Clarify: bias detection and model explainability for responsible AI.',
        whyMatters: 'Training GPT-scale models without managed infrastructure requires dozens of engineers. SageMaker automates distributed training, hyperparameter tuning, model deployment, and monitoring — an ML engineer can launch a production ML pipeline in days instead of months.',
        commonMistakes: 'Using On-Demand GPU instances for training (70-90% cheaper with Spot + checkpointing). Not using SageMaker Pipelines (ad-hoc notebooks can\'t be reproduced or audited). Deploying large models on ml.c5 (use Inferentia2 for inference cost efficiency).',
        nextTopicTitle: 'AWS Certified Solutions Architect', versionLabel: '2025', authorSub: AUTHOR_SUB, authorName: AUTHOR_NAME,
        content: `## Amazon SageMaker – End-to-End Machine Learning

> 📚 [SageMaker Developer Guide](https://docs.aws.amazon.com/sagemaker/latest/dg/) | [SageMaker Pipelines](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines.html)

### SageMaker ML Pipeline Architecture

\`\`\`mermaid
flowchart LR
    S3[S3 Raw Data] --> PROC[SageMaker Processing\nData Preprocessing]
    PROC --> S3CLEAN[S3 Clean Data]
    S3CLEAN --> TRAIN[SageMaker Training\nml.p4d.24xlarge Spot]
    TRAIN --> REG[Model Registry\nVersion + Approval]
    REG -->|Approved| SHADOW[Shadow Endpoint\nA/B Test vs prod]
    SHADOW -->|Better metrics| PROD[Production Endpoint\nml.inf2.xlarge]
    PROD --> MONITOR[SageMaker Monitor\nData + concept drift]
    MONITOR -->|Drift detected| RETRAIN[Re-trigger Pipeline]
\`\`\`

### Training Job with Spot Instances (70% cheaper)

\`\`\`python
from sagemaker.estimator import Estimator

estimator = Estimator(
    image_uri='763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:2.1.0-gpu-py310',
    role='arn:aws:iam::123:role/SageMakerRole',
    instance_type='ml.p4d.24xlarge',
    instance_count=4,              # Distributed training
    use_spot_instances=True,       # 70-90% cost saving 
    max_run=86400,                 # 24 hour max
    max_wait=172800,               # 48 hour wait for spot
    checkpoint_s3_uri='s3://my-models/checkpoints/',  # Survive interruption
    hyperparameters={
        'epochs': 100,
        'learning-rate': 0.001,
        'batch-size': 256
    }
)

estimator.fit({'train': 's3://my-data/train/', 'val': 's3://my-data/val/'})
\`\`\`

### Deploy Real-Time Endpoint with Auto Scaling

\`\`\`python
predictor = estimator.deploy(
    initial_instance_count=1,
    instance_type='ml.inf2.xlarge',    # AWS Inferentia2 — 4× cheaper than GPU for inference
    endpoint_name='fraud-detector-v2'
)

# Configure auto scaling
client = boto3.client('application-autoscaling')
client.register_scalable_target(
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/fraud-detector-v2/variant/AllTraffic',
    ScalableDimension='sagemaker:variant:DesiredInstanceCount',
    MinCapacity=1, MaxCapacity=20
)
client.put_scaling_policy(
    ServiceNamespace='sagemaker',
    ResourceId='endpoint/fraud-detector-v2/variant/AllTraffic',
    PolicyType='TargetTrackingScaling',
    TargetTrackingScalingPolicyConfiguration={
        'TargetValue': 70.0,  # Scale when GPU utilization > 70%
        'PredefinedMetricSpecification': {'PredefinedMetricType': 'SageMakerVariantInvocationsPerInstance'}
    }
)
\`\`\`

### SageMaker Pipelines – MLOps Automation

\`\`\`python
from sagemaker.workflow.pipeline import Pipeline
from sagemaker.workflow.steps import ProcessingStep, TrainingStep

processing_step = ProcessingStep(name='Preprocess', processor=sklearn_processor, ...)
training_step = TrainingStep(name='Train', estimator=estimator, depends_on=[processing_step])
register_step = RegisterModel(name='Register', ..., approval_status='PendingManualApproval')

pipeline = Pipeline(name='fraud-detection-pipeline', steps=[processing_step, training_step, register_step])
pipeline.upsert(role_arn=role)
pipeline.start()  # Trigger manually or on EventBridge schedule
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
