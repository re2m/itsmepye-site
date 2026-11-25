// Single source for Things / Notes items, used by the home page and the listing pages.
// Newest first. `summary` is the one-line teaser shown in "최근 업데이트" on the home page.
export interface Entry {
	title: string;
	href: string;
	image: string;
	imageAlt?: string;
	summary: string;
	label: string;
}

export const categories = {
	things: {
		title: "Things",
		tagline: ["작은 불편을 발견하고", "해결하는 실험실"],
		blurb: "직접 만든 서비스와 도구",
		href: "/things",
		image: "/images/thumbs/goal.svg",
	},
	notes: {
		title: "Notes",
		tagline: ["누구나 호기심을", "쓸모있는 것으로 만들 수 있는 도구"],
		blurb: "직접 해보고 정리한 가이드",
		href: "/notes",
		image: "/images/thumbs/diary.svg",
	},
} as const;

export const things: Entry[] = [
	{ title: "1분 안에 수제 송편 만들기", href: "/things/ricecake/", image: "/images/thumbs/ricecake.svg", label: "서비스", summary: "재료와 모양을 골라 나만의 송편을 빚고, 직접 만든 송편과 함께 마음을 전해보세요." },
	{ title: "나만의 목표 시스템 만들기", href: "/things/goal/", image: "/images/thumbs/goal.svg", label: "서비스", summary: "노트 2권과 펜 2자루로 만들던 목표 시스템을 3분 만에 질문에 답하면서 완성해요." },
];

export const notes: Entry[] = [
	{ title: "비개발자를 위한 토스 미니앱 출시 가이드북", href: "/notes/appintoss", image: "/images/thumbs/appintoss.svg", label: "가이드북", summary: "개발 지식 없이 AI와 함께 토스 미니앱을 기획하고, 디자인하고, 출시하기까지 4단계." },
	{ title: "1시간 만에 360도 회전 3D 요소 만들기", href: "/notes/3dedit", image: "/images/thumbs/3dedit.svg", label: "TIP", summary: "디자인 비전공자도 1시간이면 360도 회전하는 Clay 3D 요소를 만들 수 있어요." },
	{ title: "클로드로 카카오톡 자동 발송 설정하는 방법", href: "/notes/kakaochat", image: "/images/thumbs/kakaochat.svg", label: "TIP", summary: "클로드에게 \"카카오톡으로 보내줘\" 한마디면 주식 현황, 할 일, 뉴스 요약이 도착해요." },
	{ title: "나만의 다이어리 만드는 방법", href: "/notes/tip-diary", image: "/images/thumbs/diary.svg", label: "TIP", summary: "판형부터 내지, 표지, 제본, 발주까지. 1년 내내 애정하며 쓸 다이어리를 직접 만들어요." },
];
