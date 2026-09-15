import { Chip, Typography } from "@mui/material";
import { styled } from "@mui/material";
import {
  Button,
  LoadingContainer,
  Markdown,
  OverflowWithTooltip,
  Progress,
  TitleContainer,
} from "components";
import { StyledFlexColumn, StyledFlexRow } from "styles";
import { BsFillCheckCircleFill } from "react-icons/bs";
import { AiFillCloseCircle } from "react-icons/ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { nFormatter } from "utils";
import _ from "lodash";
import {  useVerifyProposalResults } from "../hooks";
import { EndpointPopup } from "./EndpointPopup";
import { useProposalPageTranslations } from "i18n/hooks/useProposalPageTranslations";
import { mock } from "mock/mock";
import { errorToast } from "toasts";
import {  useAppParams, useProposalResults } from "hooks/hooks";
import { useProposalQuery } from "query/getters";
import { Vote } from "types";
const LIMIT = 5;

const CHOICE_COLORS = [
  "#42a5f5",
  "#ffa726",
  "#66bb6a",
  "#ef5350",
  "#ab47bc",
  "#ec407a",
  "#26a69a",
  "#ffca28",
  "#8d6e63",
  "#5c6bc0",
  "#78909c",
  "#e91e63",
];

// Цвета вариантов, за которые отданы голоса, разбрасываются максимально
// равномерно по всей палитре. Порядок — позиция варианта в списке choices,
// поэтому линии графика и полосы прогресса в результатах всегда совпадают.
const getVotedColorsMap = (
  choices: string[],
  votedNames: string[],
): Record<string, string> => {
  const indexInChoices = (name: string) =>
    choices.findIndex(
      (item) => item.toLowerCase() === String(name).toLowerCase(),
    );

  const sorted = votedNames
    .slice()
    .sort(
      (a, b) =>
        indexInChoices(a) - indexInChoices(b) ||
        String(a).localeCompare(String(b)),
    );

  const map: Record<string, string> = {};
  const n = sorted.length;
  if (!n) return map;
  sorted.forEach((name, rank) => {
    const idx =
      n > 1 ? Math.round((rank * (CHOICE_COLORS.length - 1)) / (n - 1)) : 0;
    map[name] = CHOICE_COLORS[idx % CHOICE_COLORS.length];
  });
  return map;
};

type VotePoint = {
  x: number;
  y: number;
  count: number;
  vote: Vote;
};

type LineSeries = {
  choice: string;
  color: string;
  votesCount: number;
  points: [number, number][];
  votePoints: VotePoint[];
};

type ChartTooltip = {
  left: number;
  top: number;
  color: string;
  title: string;
  subtitle: string;
};

const plural = (n: number) =>
  n % 10 === 1 && n % 100 !== 11
    ? "голос"
    : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
      ? "голоса"
      : "голосов";

const shortAddress = (address: string) =>
  address.length > 8
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;

const VotesLineChart = ({
  votes,
  choices,
  startTime,
  endTime,
}: {
  votes?: Vote[];
  choices?: string[];
  startTime?: number;
  endTime?: number;
}) => {
  const series = useMemo(() => {
    if (
      !startTime ||
      !endTime ||
      !Array.isArray(choices) ||
      !choices.length
    ) {
      return [];
    }
    const start = Number(startTime);
    const end = Number(endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return [];
    }

    const seconds = (ts: number) => (ts > 1e12 ? ts / 1000 : ts);
    const choicesByLowerCase = _.keyBy(choices, (it) => it.toLowerCase());

    const resolveChoice = (value: string): string | undefined => {
      const next = String(value ?? "").trim();
      if (!next) return undefined;

      const numericIndex = Number(next);
      if (!Number.isNaN(numericIndex)) {
        const zeroBasedChoice = choices[numericIndex];
        const oneBasedChoice = choices[numericIndex - 1];
        if (zeroBasedChoice || oneBasedChoice) {
          return zeroBasedChoice || oneBasedChoice;
        }
      }

      const byExact = choicesByLowerCase[next.toLowerCase()];
      if (byExact) return byExact;

      return _.find(
        choices,
        (choice) =>
          choice.substring(0, 127).toLowerCase() === next.toLowerCase(),
      );
    };

    const inTime = _.filter(votes || [], (vote) => {
      const ts = seconds(vote.timestamp);
      return ts >= start && ts <= end;
    });

    // Позиция по горизонтали зависит от порядка голосов (равные отрезки по
    // всей ширине графика), а не от времени — иначе голоса, отданные в первые
    // минуты голосования, кучковались бы слева, и линии были бы видны только
    // в начале голосования.
    const events = _.orderBy(inTime, "timestamp", "asc");
    const totalEvents = events.length;
    const rankByEvent = new Map<Vote, number>();
    events.forEach((event, index) => rankByEvent.set(event, index));

    const width = 100;
    const height = 40;
    const xOfEvent = (event: Vote) =>
      totalEvents > 1
        ? (rankByEvent.get(event) || 0) * (width / (totalEvents - 1))
        : width / 2;

    // Группируем голоса по вариантам, за которые они отданы. Вариант попадает
    // на график, только если за него был отдан хотя бы один голос.
    const grouped: Record<string, Vote[]> = {};
    _.forEach(inTime, (vote) => {
      const rawVotes = _.isArray(vote.vote) ? vote.vote : [vote.vote];
      _.forEach(rawVotes, (rawValue) => {
        const choice = resolveChoice(rawValue);
        if (!choice) return;
        (grouped[choice] || (grouped[choice] = [])).push(vote);
      });
    });

    const names = Object.keys(grouped).filter((name) => grouped[name].length);
    const maxCount = Math.max(1, ...names.map((name) => grouped[name].length));
    const colorMap = getVotedColorsMap(choices, names);

    const topPad = 3;
    const bottomPad = 5;
    const minLift = 0.1;
    // Вариант с минимальным числом голосов приподнимаем заметно выше нижней
    // кромки, чтобы даже один голос был хорошо виден (не сливался с низом).
    const y = (count: number) => {
      const lift = Math.max(count / maxCount, minLift);
      return height - bottomPad - lift * (height - topPad - bottomPad);
    };

    return names.map((name) => {
      const sorted = _.orderBy(grouped[name], "timestamp", "asc");

      const votePoints: VotePoint[] = [];
      let count = 0;
      sorted.forEach((vote) => {
        count += 1;
        votePoints.push({ x: xOfEvent(vote), y: count, count, vote });
      });

      // Все линии начинаются из начала координат — левого нижнего угла графика
      // — даже если первый голос варианта был отдан позже, чем начались другие.
      const points: [number, number][] = [
        [0, 0],
        ...votePoints.map((vp) => [vp.x, vp.y] as [number, number]),
      ];

      // Протягиваем линию до правого края графика — без разрывов от последнего
      // голоса к текущему балансу, который показывается точкой справа.
      const lastVoteX = xOfEvent(sorted[sorted.length - 1]);
      if (lastVoteX < width) {
        points.push([width, count]);
      }

      // Начало координат (0, 0) — это нижняя кромка графика.
      const toY = (py: number) => (py === 0 ? height : y(py));

      return {
        choice: name,
        color: colorMap[name],
        votesCount: count,
        points: points.map(([px, py]) => [px, toY(py)] as [number, number]),
        votePoints: votePoints.map((vp) => ({ ...vp, y: toY(vp.y) })),
      };
    });
  }, [votes, choices, startTime, endTime]);

  if (!series.length) return null;

  const totalVotes = series.reduce((acc, s) => acc + s.votesCount, 0);

  const [tooltip, setTooltip] = useState<ChartTooltip | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Позиция тултипа считается от реального размера контейнера графика. Кружки
  // рисуем не внутри svg (viewBox там растягивается по ширине и превратил бы
  // круги в эллипсы), а поверх — обычными HTML-элементами, поэтому координаты
  // пересчитываем из нормализованных viewBox-координат в проценты/пиксели.
  const showTooltip = (
    x: number,
    y: number,
    color: string,
    title: string,
    subtitle: string,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const left = rect
      ? Math.min(Math.max((x / 100) * rect.width + 12, 0), rect.width - 150)
      : 0;
    const top = Math.min(
      Math.max((y / 40) * CHART_PX_HEIGHT, 8),
      CHART_PX_HEIGHT - 20,
    );
    setTooltip({ left, top, color, title, subtitle });
  };

  // Если несколько вариантов завершают график с одинаковым результатом, их
  // конечные точки попадают на одну высоту. Разводим такие точки вплотную по
  // горизонтали, чтобы они не перекрывались.
  const endDotXByChoice = useMemo(() => {
    const byY: Record<string, LineSeries[]> = {};
    series.forEach((s) => {
      const endY = s.points[s.points.length - 1][1];
      (byY[endY] || (byY[endY] = [])).push(s);
    });

    const map: Record<string, number> = {};
    const anchorX = 97;
    const spacing = 1.6;
    Object.values(byY).forEach((group) => {
      const n = group.length;
      const base = anchorX - ((n - 1) * spacing) / 2;
      group.forEach((s, i) => {
        map[s.choice] = base + i * spacing;
      });
    });
    return map;
  }, [series]);

  return (
    <StyledLineChart ref={containerRef}>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
      >
        {series.map((s) => (
          <path
            key={`${s.choice}:l`}
            d={s.points
              .map(
                ([px, py], i) =>
                  `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`,
              )
              .join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {/* Кружки рисуем HTML-элементами поверх svg: внутри растянутого viewBox
          они превращались бы в эллипсы. Каждую точку оборачиваем в невидимую
          зону в 12px, чтобы наводить указатель было удобно. */}
      {totalVotes <= 60 &&
        series.map((s) =>
          s.votePoints.map((vp, i) => (
            <StyledDotHit
              key={`${s.choice}:vp${i}`}
              style={{
                left: `${(vp.x / 100) * 100}%`,
                top: `${(vp.y / 40) * CHART_PX_HEIGHT}px`,
              }}
              onMouseEnter={() =>
                showTooltip(
                  vp.x,
                  vp.y,
                  s.color,
                  `${s.choice}: ${vp.count} ${plural(vp.count)}`,
                  shortAddress(vp.vote.address),
                )
              }
              onMouseLeave={() => setTooltip(null)}
            >
              <StyledDot color={s.color} size={8} />
            </StyledDotHit>
          )),
        )}
      {series.map((s) => {
        const endY = s.points[s.points.length - 1][1];
        const endDotX = endDotXByChoice[s.choice] ?? 100;
        return (
          <StyledDotHit
            key={`${s.choice}:end`}
            style={{
              left: `${(endDotX / 100) * 100}%`,
              top: `${(endY / 40) * CHART_PX_HEIGHT}px`,
            }}
            onMouseEnter={() =>
              showTooltip(
                endDotX,
                endY,
                s.color,
                `${s.choice}: ${s.votesCount} ${plural(s.votesCount)}`,
                "Итоговый результат",
              )
            }
            onMouseLeave={() => setTooltip(null)}
          >
            <StyledDot color={s.color} size={10} />
          </StyledDotHit>
        );
      })}
      {tooltip && (
        <StyledTooltip style={{ left: tooltip.left, top: tooltip.top }}>
          <StyledTooltipTitle color={tooltip.color}>
            {tooltip.title}
          </StyledTooltipTitle>
          <StyledTooltipSub>{tooltip.subtitle}</StyledTooltipSub>
        </StyledTooltip>
      )}
    </StyledLineChart>
  );
};

const CHART_PX_HEIGHT = 120;

const StyledLineChart = styled("div")({
  position: "relative",
  width: "100%",
  height: CHART_PX_HEIGHT,
  svg: {
    display: "block",
    width: "100%",
    height: "100%",
  },
});

const StyledDotHit = styled("span")({
  position: "absolute",
  padding: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transform: "translate(-50%, -50%)",
  cursor: "pointer",
});

const StyledDot = styled("span")<{ color: string; size: number }>(
  ({ color, size }) => ({
    width: size,
    height: size,
    borderRadius: "50%",
    backgroundColor: color,
    display: "block",
  }),
);

const StyledTooltip = styled("div")({
  position: "absolute",
  transform: "translate(10px, -50%)",
  pointerEvents: "none",
  zIndex: 10,
  maxWidth: 180,
  background: "rgba(18, 32, 48, 0.96)",
  borderRadius: 6,
  padding: "5px 9px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
  whiteSpace: "nowrap",
});

const StyledTooltipTitle = styled("div", {
  shouldForwardProp: (prop) => prop !== "color",
})<{ color: string }>(({ color }) => ({
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.35,
  color,
}));

const StyledTooltipSub = styled("div")({
  fontSize: 11,
  lineHeight: 1.35,
  color: "rgba(255,255,255,0.75)",
});

export const Results = () => {
    const { proposalAddress } = useAppParams();

  const { isLoading, data } = useProposalQuery(proposalAddress);
  
  const [showAllResults, setShowAllResults] = useState(false);
  const translations = useProposalPageTranslations();

  const results = useProposalResults(proposalAddress);

  const choices = data?.metadata?.votingSystem?.choices;
  // Цвета для прогресс-баров берём из той же карты, что и в графике, чтобы
  // полоса каждого варианта совпадала с цветом его линии.
  const votedColors = useMemo(
    () =>
      choices?.length
        ? getVotedColorsMap(
            choices,
            results.filter((r) => r.votesCount > 0).map((r) => r.choice),
          )
        : {},
    [choices, results],
  );

  if (isLoading) {
    return <LoadingContainer />;
  }

  return (
    <StyledResults title={translations.results}>
      <VotesLineChart
        votes={data?.votes}
        choices={data?.metadata?.votingSystem?.choices}
        startTime={data?.metadata?.proposalStartTime}
        endTime={data?.metadata?.proposalEndTime}
      />
      <StyledFlexColumn gap={15}>
        {results.map((result, index) => {
          if (index >= LIMIT && !showAllResults) return null;

          return (
            <ResultRow
              key={result.choice}
              name={result.choice}
              percent={result.percent}
              amount={result.amount}
              votes={result.votesCount}
              // Закрашиваем полосу прогресса в цвет линии графика, но только
              // для вариантов, за которые отданы голоса (у них есть линия).
              color={
                result.votesCount > 0 ? votedColors[result.choice] : undefined
              }
            />
          );
        })}

        {_.size(results) > LIMIT && (
          <ToggleResultsButton
            toggle={setShowAllResults}
            value={showAllResults}
          />
        )}
      </StyledFlexColumn>
      <VerifyResults />
    </StyledResults>
  );
};

const ToggleResultsButton = ({
  toggle,
  value,
}: {
  toggle: (value: boolean) => void;
  value: boolean;
}) => {
  const translations = useProposalPageTranslations();
  return (
    <StyledToggleResultsButton onClick={() => toggle(!value)}>
      {value ? translations.showLess : translations.showMore}
    </StyledToggleResultsButton>
  );
};

const StyledToggleResultsButton = styled(Button)({
  padding: "6px 10px",
  height: "unset",
  marginLeft: "auto",
  "*": {
    fontSize: 12,
  },
});

const ResultRow = ({
  name,
  percent = 0,
  amount = "",
  votes,
  color,
}: {
  name: string;
  percent?: number;
  amount?: string;
  votes: number;
  color?: string;
}) => {

  const translations = useProposalPageTranslations();
  return (
    <StyledResultRow>
      <StyledFlexRow justifyContent="space-between" width="100%">
        <StyledFlexRow style={{ width: "fit-content" }}>
          <div>
            <StyledTitle text={name} />
          </div>
          <StyledChip label={`${nFormatter(votes, 2)} ${translations.votes}`} />
        </StyledFlexRow>

        <StyledResultRowRight justifyContent="flex-end">
          {amount && (
            <Typography fontSize={13} style={{ whiteSpace: "nowrap" }}>
              {amount}
            </Typography>
          )}

          <Typography className="percent">{percent}%</Typography>
        </StyledResultRowRight>
      </StyledFlexRow>
      <Progress progress={percent} color={color} />
    </StyledResultRow>
  );
};

const StyledTitle = styled(OverflowWithTooltip)({
  textTransform: "capitalize",
});

const StyledChip = styled(Chip)({
  fontSize: 11,
  height: 25,
  ".MuiChip-label": {
    paddingLeft: 10,
    paddingRight: 10,
  },
});

const StyledResultRowRight = styled(StyledFlexRow)({
  flex: 1,
});

const StyledResultRow = styled(StyledFlexColumn)({
  gap: 5,
  fontWeight: 600,
  p: {
    fontWeight: "inherit",
  },
  ".percent": {
    fontSize: 14,
  },
});

const StyledResults = styled(TitleContainer)({
  width: "100%",
});

export function VerifyResults() {
  const {
    mutate: verify,
    isLoading,
    error,
    isSuccess,
    reset,
  } = useVerifyProposalResults();
  const translations = useProposalPageTranslations();
  const {proposalAddress} = useAppParams();
  useEffect(() => {
    if (isSuccess || error) {
      setTimeout(() => {
        reset();
      }, 5_000);
    }
  }, [isSuccess, reset, error]);

  const [open, setOpen] = useState(false);

  const onClick = () => {
    if (mock.isMockProposal(proposalAddress)) {
      errorToast("This is a mock proposal. You can not verify it.");
    } else {
      setOpen(true);
    }
  };

  return (
    <StyledVerifyContainer>
      <StyledVerifyText>{translations.verifyInfo}</StyledVerifyText>
      <EndpointPopup
        onSubmit={verify}
        open={open}
        onClose={() => setOpen(false)}
      />
      {isSuccess ? (
        <StyledButton>
          <StyledFlexRow>
            <Typography>Проверено</Typography>
            <BsFillCheckCircleFill className="icon" />
          </StyledFlexRow>
        </StyledButton>
      ) : error ? (
        <StyledButton>
          <StyledFlexRow>
            <Typography>Не проверено</Typography>
            <AiFillCloseCircle className="icon" />
          </StyledFlexRow>
        </StyledButton>
      ) : (
        <StyledButton onClick={onClick} isLoading={isLoading}>
          <Typography>{translations.verifyResults}</Typography>
        </StyledButton>
      )}
    </StyledVerifyContainer>
  );
}

const StyledVerifyContainer = styled(StyledFlexColumn)(({ theme }) => ({
  marginTop: 30,
  justifyContent: "center",
  width: "100%",
  gap: 15,
}));

const StyledVerifyText = styled(Markdown)({
  fontWeight: 500,
  a: {
    textDecoration: "unset",
  },
});

const StyledButton = styled(Button)({
  height: 40,
  minWidth: 180,
  "*": {
    fontSize: 15,
  },
  ".icon": {
    width: 18,
    height: 18,
  },
  ".loader": {
    maxWidth: 20,
    maxHeight: 20,
  },
});
