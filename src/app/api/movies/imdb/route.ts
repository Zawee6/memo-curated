import { NextRequest, NextResponse } from 'next/server';
import { fetchMovieImdbData } from '@/lib/imdbService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const title = (searchParams.get('title') || '').trim();
    const originalTitle = (searchParams.get('en') || '').trim();
    const releaseYear = (searchParams.get('year') || '').trim();
    const imdbId = (searchParams.get('imdbId') || '').trim();

    if (!title && !originalTitle && !imdbId) {
      return NextResponse.json(
        { success: false, error: '請提供電影中文、英文片名或 IMDb ID。' },
        { status: 400 }
      );
    }

    const result = await fetchMovieImdbData(title, originalTitle, releaseYear, imdbId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `IMDb 查詢失敗：${errMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = (body.title || body.movieTitle || '').trim();
    const originalTitle = (body.originalTitle || body.en || '').trim();
    const releaseYear = (body.releaseYear || body.year || '').trim();
    const imdbId = (body.imdbId || '').trim();

    if (!title && !originalTitle && !imdbId) {
      return NextResponse.json(
        { success: false, error: '請提供電影中文、英文片名或 IMDb ID。' },
        { status: 400 }
      );
    }

    const result = await fetchMovieImdbData(title, originalTitle, releaseYear, imdbId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `IMDb 同步失敗：${errMessage}` },
      { status: 500 }
    );
  }
}
