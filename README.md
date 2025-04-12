# cite-me - PDF Citation Generator

cite-me is an advanced citation and footnote transcriber tool that helps researchers, students, and writers generate proper citations for their work. The application can extract citations from PDF documents and check for uncited content against reference sources.

## Features

- Upload PDF files or paste text content for citation analysis
- Support for multiple citation styles (APA, MLA, Chicago, OSCOLA, IEEE, AMA)
- Detect improperly cited content and suggest corrections
- Generate a comprehensive bibliography/footnotes section
- Download citations in PDF or Word format
- Rich text editing of citations
- Modern, user-friendly interface

## Getting Started

### Prerequisites

To run this project locally, you need:
- Node.js 18.0 or later
- A Supabase account for storage
- An OpenAI API key
- Browserless API key
- TinyMCE API key (free tier available)

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
NEXT_PUBLIC_TINYMCE_API_KEY=your_tinymce_api_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) to view the application.

## TinyMCE Integration

This project uses TinyMCE for rich text editing of citations. To use TinyMCE:

1. Sign up for a free API key at [https://www.tiny.cloud/auth/signup/](https://www.tiny.cloud/auth/signup/)
2. Add your API key to the `.env.local` file as `NEXT_PUBLIC_TINYMCE_API_KEY`
3. The free tier provides 50,000 editor initializations per month, which is sufficient for most use cases

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
- Rich text editing by TinyMCE

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
