import { paymentBody } from "@/features/payments/http";
import { reviewResponse } from "@/features/reviews/http";
import { discussionBody } from "@/features/reviews/discussion-http";
import { changeDiscussion, getDiscussion, publishDiscussion } from "@/features/reviews/discussion-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return reviewResponse(() => getDiscussion(new URL(request.url).searchParams)); }
export async function POST(request: Request) { return reviewResponse(async () => { const { input, images } = await discussionBody(request); return publishDiscussion(input, images); }); }
export async function PATCH(request: Request) { return reviewResponse(async () => changeDiscussion(await paymentBody(request, true))); }
export async function DELETE(request: Request) { return reviewResponse(async () => changeDiscussion(await paymentBody(request, true), true)); }
