import { NextRequest } from 'next/server';
import { POST as handleItineraryPost } from '@/app/api/itinerary/route';

export async function POST(req: NextRequest) {
  return handleItineraryPost(req);
}
