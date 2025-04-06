# Cite Me - PDF Citation Generator

Cite Me is an advanced citation and footnote transcriber tool that helps researchers, students, and writers generate proper citations for their work. The application can extract citations from PDF documents and check for uncited content against reference sources.

## Features

- Upload PDF files or paste text content for citation analysis
- Support for multiple citation styles (APA, MLA, Chicago, OSCOLA, IEEE, AMA)
- Detect improperly cited content and suggest corrections
- Generate a comprehensive bibliography/footnotes section
- Download citations in PDF or Word format
- Modern, user-friendly interface

## Getting Started

### Prerequisites

To run this project locally, you need:
- Node.js 18.0 or later
- A Supabase account for storage
- An OpenAI API key
- Browserless API key

### Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with the following variables:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) to view the application.

## Edge Function Setup

This application uses Supabase Edge Functions for processing PDFs and generating citations. To set up the Edge Function:

1. Deploy the Edge Function to your Supabase project
2. Set the required environment variables in the Supabase Dashboard:
   - OPENAI_API_KEY
   - BROWSERLESS_API_KEY

## License

MIT

## Acknowledgements

- Built with Next.js
- Uses OpenAI's GPT models for citation generation
- Uses Browserless for PDF processing
- Powered by Supabase for backend functionality

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
