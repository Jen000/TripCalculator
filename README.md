# TripCalculator

A full-stack travel expense tracker built with React, AWS serverless architecture, and modern UI components. Track your travel expenses across multiple trips with secure authentication and real-time data synchronization.

## Features

### User Experience
- **Multiple Trip Management** - Create and organize unlimited trips
- **Expense Tracking** - Add, view, and manage expenses per trip
- **Summary Dashboard** - View expense breakdowns and totals
- **CSV Export** - Download expense reports for your records
- **Account Management** - Update profile settings and password
- **Responsive Design** - Seamless experience on desktop and mobile
- **Dark/Light Themes** - Toggle between color modes

### Security
- **AWS Cognito Authentication** - Enterprise-grade user management
- **Pre-approved Accounts** - No self-registration (admin-controlled)
- **Token-based Auth** - Secure session management
- **Per-user Data Isolation** - Your data stays private

### Backend Capabilities
- **Serverless Architecture** - Scales automatically with demand
- **RESTful API** - Clean, documented endpoints
- **DynamoDB Storage** - Fast, reliable NoSQL database
- **API Gateway** - Rate limiting and request validation

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript |
| **UI Framework** | Material UI (MUI) |
| **Authentication** | AWS Cognito |
| **Backend** | AWS Lambda, API Gateway |
| **Database** | Amazon DynamoDB |
| **Hosting** | AWS Amplify |
| **CI/CD** | GitHub → Amplify Auto-Deploy |

## API Endpoints

### Trips
- `GET /trips` - List all trips for authenticated user
- `POST /trips` - Create a new trip
- `DELETE /trips/{id}` - Delete a trip

### Expenses
- `GET /expenses?tripId={id}` - Get expenses for a trip
- `POST /expenses` - Add a new expense
- `GET /expenses/export?tripId={id}` - Export expenses as CSV

## Project Structure

```
TripCalculator/
├── src/
│   ├── api/              # API service layer
│   │   ├── trips.ts
│   │   └── expenses.ts
│   ├── components/       # Reusable UI components
│   ├── context/          # React Context (TripContext)
│   ├── pages/            # Application pages/routes
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Expenses.tsx
│   │   └── Summary.tsx
│   ├── aws-config.ts     # AWS Amplify configuration
│   ├── theme.ts          # Material UI theme customization
│   └── main.tsx          # Application entry point
├── vite.config.ts        # Vite build configuration
├── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn
- AWS account with Cognito, Lambda, API Gateway, and DynamoDB configured

### 1. Clone the Repository

```bash
git clone https://github.com/Jen000/TripCalculator.git
cd TripCalculator
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_API_BASE_URL=https://<your-api-id>.execute-api.<region>.amazonaws.com
```

### 4. Update AWS Configuration

Edit `src/aws-config.ts` with your Cognito details:

```typescript
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'your-user-pool-id',
      userPoolClientId: 'your-app-client-id',
      loginWith: { 
        username: true, 
        email: false 
      },
    },
  },
});
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## AWS Infrastructure Setup

### Amazon Cognito

1. **Create User Pool** with the following settings:
   - Sign-in options: Username only
   - Disable self-registration
   - Create app client (no client secret)

2. **Configure Hosted UI** (optional) or use custom login

3. **Set Allowed Callback URLs:**
   ```
   http://localhost:5173
   https://www.tripexpenses.click
   ```

4. **Set Allowed Sign-out URLs:**
   ```
   http://localhost:5173
   https://www.tripexpenses.click
   ```

### API Gateway

1. **Create REST API**
2. **Enable CORS** for all routes:
   - **Allowed Origins:**
     - `http://localhost:5173`
     - `https://www.tripexpenses.click`
   - **Allowed Headers:**
     - `Authorization`
     - `Content-Type`
   - **Allowed Methods:**
     - `GET`, `POST`, `DELETE`, `OPTIONS`

3. **Create Routes** (see API Endpoints section)
4. **Attach Lambda Functions** to each route
5. **Deploy API** to a stage

### DynamoDB Tables

#### Trips Table
- **Partition Key:** `userSub` (String)
- **Sort Key:** `tripId` (String)
- **Attributes:** `tripName`, `startDate`, `endDate`, `createdAt`

#### Expenses Table
- **Partition Key:** `userSub` (String)
- **Sort Key:** `expenseId` (String)
- **Attributes:** `tripId`, `description`, `amount`, `category`, `date`, `createdAt`

### AWS Lambda

Create Lambda functions for each API endpoint with:
- **Runtime:** Node.js 18.x or Python 3.x
- **Permissions:** DynamoDB read/write access
- **Environment Variables:** Table names, region

## Deployment

### AWS Amplify Deployment

1. **Connect Repository:**
   - Go to AWS Amplify Console
   - Connect your GitHub repository
   - Select the main branch

2. **Configure Build Settings:**
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

3. **Set Environment Variables:**
   - `VITE_API_BASE_URL` = Your API Gateway URL

4. **Configure Rewrites and Redirects:**
   - **Source:** `/<*>`
   - **Target:** `/index.html`
   - **Status:** `200` (SPA)

5. **Deploy** - Amplify will automatically build and deploy on every push to main

## Testing

### Local Testing
```bash
npm run dev
```

### Backend Testing
1. Use API Gateway test console
2. Test each endpoint with sample payloads
3. Verify DynamoDB entries
4. Check Lambda CloudWatch logs

### Example Test Requests

**Create Trip:**
```bash
curl -X POST https://your-api.execute-api.region.amazonaws.com/trips \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tripName": "Paris 2024", "startDate": "2024-06-01", "endDate": "2024-06-10"}'
```

## Troubleshooting

### Blank Trips/Expenses
- Verify CORS settings in API Gateway
- Check network requests in browser DevTools
- Review Lambda CloudWatch logs
- Confirm production domain in Cognito allowed origins

### Authentication Issues
- Verify Cognito User Pool and App Client IDs
- Check callback URLs match exactly
- Ensure user exists and is confirmed

### API Errors
- Validate API Gateway deployment
- Check Lambda function permissions
- Verify DynamoDB table names and permissions

## Export Functionality

From the Summary page:
1. Click **Export CSV** button
2. Download generated file
3. Filename includes trip name for easy organization

CSV includes: Date, Description, Category, Amount

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows project style guidelines
- Tests are included where applicable
- Documentation is updated

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgements

Built with these technologies:
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Material UI](https://mui.com/) - Component library
- [AWS Amplify](https://aws.amazon.com/amplify/) - Hosting & deployment
- [AWS Cognito](https://aws.amazon.com/cognito/) - Authentication
- [AWS Lambda](https://aws.amazon.com/lambda/) - Serverless functions
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) - Database

## Contact

For questions or support, please open an issue on GitHub.

---

**Made with care for travelers who want to track their expenses**