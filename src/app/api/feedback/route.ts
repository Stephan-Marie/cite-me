import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('Received feedback request');
    const body = await request.json();
    const { message } = body;

    if (!process.env.CANNY_API_KEY) {
      console.error('Missing Canny API key');
      return NextResponse.json(
        { error: 'Canny API configuration missing' },
        { status: 500 }
      );
    }

    // First, fetch the list of boards
    console.log('Fetching Canny boards');
    const boardsResponse = await fetch('https://canny.io/api/v1/boards/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: process.env.CANNY_API_KEY
      })
    });

    if (!boardsResponse.ok) {
      console.error('Failed to fetch Canny boards:', await boardsResponse.text());
      return NextResponse.json(
        { error: 'Failed to fetch Canny boards' },
        { status: boardsResponse.status }
      );
    }

    const boardsData = await boardsResponse.json();
    console.log('Canny boards data:', boardsData);

    // Find the board with name "Bugs & Features"
    const board = boardsData.boards.find((b: any) => b.name === 'Bugs & Features');
    if (!board) {
      console.error('Board not found');
      return NextResponse.json(
        { error: 'Board not found' },
        { status: 500 }
      );
    }

    console.log('Using board ID:', board.id);

    // Fetch the list of users to get an authorID
    console.log('Fetching Canny users');
    const usersResponse = await fetch('https://canny.io/api/v1/users/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: process.env.CANNY_API_KEY
      })
    });

    if (!usersResponse.ok) {
      console.error('Failed to fetch Canny users:', await usersResponse.text());
      return NextResponse.json(
        { error: 'Failed to fetch Canny users' },
        { status: usersResponse.status }
      );
    }

    const usersData = await usersResponse.json();
    console.log('Canny users data:', usersData);

    // Use the first user's ID as the author
    const authorID = usersData[0]?.id;
    if (!authorID) {
      console.error('No users found in Canny');
      return NextResponse.json(
        { error: 'No users found in Canny' },
        { status: 500 }
      );
    }

    console.log('Using authorID:', authorID);

    // Now create the post with the authorID
    console.log('Making request to Canny API');
    const cannyResponse = await fetch('https://canny.io/api/v1/posts/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: process.env.CANNY_API_KEY,
        boardID: board.id,
        title: 'User Feedback',
        details: message,
        authorID: authorID
      })
    });

    console.log('Canny API response status:', cannyResponse.status);
    let cannyData;
    try {
      cannyData = await cannyResponse.json();
      console.log('Canny API response data:', cannyData);
    } catch (e) {
      console.error('Failed to parse Canny response:', e);
      return NextResponse.json(
        { error: 'Failed to parse Canny API response' },
        { status: 500 }
      );
    }

    if (!cannyResponse.ok) {
      console.error('Canny API error:', cannyData);
      return NextResponse.json(
        { error: cannyData.error || 'Failed to submit to Canny' },
        { status: cannyResponse.status }
      );
    }

    return NextResponse.json({ success: true, data: cannyData });
  } catch (error) {
    console.error('Error in feedback API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 