import React from 'react'
import { Box, Card, CardContent, CardHeader, Stack, Typography } from '@mui/material'
import { Bar, Doughnut, Scatter } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'
import type { AggregatedQuestion } from '../types'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, ChartTooltip, Legend)

const PALETTE = ['#7c5cff', '#00b0ff', '#ff5c8d', '#ffb020', '#4caf50', '#f062c0', '#64d3ff']

function NoulChart({ agg }: { agg: AggregatedQuestion }) {
  const data = {
    labels: ['yes (>0.5)', 'no (≤0.5)'],
    datasets: [
      {
        label: agg.id,
        data: [agg.yesCount, agg.noCount],
        backgroundColor: [PALETTE[2], PALETTE[4]],
      },
    ],
  }
  const scatter = {
    datasets: [
      {
        label: `${agg.id} probs`,
        data: agg.probs.map((p, i) => ({ x: i + 1, y: p })),
        backgroundColor: PALETTE[0],
        pointStyle: 'triangle',
      },
    ],
  }
  return (
    <Stack spacing={2}>
      <Box sx={{ width: 260, mx: 'auto' }}>
        <Doughnut data={data} />
      </Box>
      <Box sx={{ width: '100%', height: 220 }}>
        <Scatter data={scatter} options={{ scales: { y: { min: 0, max: 1 } } }} />
      </Box>
    </Stack>
  )
}

function DistributionChart({ agg }: { agg: AggregatedQuestion }) {
  const entries = Object.entries(agg.counts).sort((a, b) => b[1] - a[1])
  const data = {
    labels: entries.map(([k]) => k),
    datasets: [
      {
        label: agg.id,
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
      },
    ],
  }
  const probs = Object.entries(agg.avgProbs).sort((a, b) => b[1] - a[1])
  const probsData = {
    labels: probs.map(([k]) => k),
    datasets: [
      {
        label: 'avg probability',
        data: probs.map(([, v]) => (v * 100).toFixed(1)),
        backgroundColor: probs.map((_, i) => PALETTE[i % PALETTE.length]),
      },
    ],
  }
  return (
    <Stack spacing={2}>
      <Box sx={{ width: '100%', height: 320 }}>
        <Bar data={data} options={{ indexAxis: 'y' }} />
      </Box>
      {probs.length > 0 && (
        <Box sx={{ width: '100%', height: 280 }}>
          <Bar data={probsData} options={{ indexAxis: 'y' }} />
        </Box>
      )}
    </Stack>
  )
}

export default function Charts({ aggs }: { aggs: AggregatedQuestion[] }) {
  if (aggs.length === 0) return null
  return (
    <Stack spacing={2}>
      {aggs.map((agg) => (
        <Card key={agg.id}>
          <CardHeader
            title={agg.id}
            subheader={`${agg.instructions} — ${agg.total} answered`}
            action={
              <Typography variant="caption">
                {agg.type === 'noul'
                  ? `mean prob ${(agg.meanProb * 100).toFixed(1)}% · conf ${(agg.meanConfidence * 100).toFixed(1)}%`
                  : `avg prob per option`}
              </Typography>
            }
          />
          <CardContent>
            {agg.type === 'noul' ? <NoulChart agg={agg} /> : <DistributionChart agg={agg} />}
          </CardContent>
        </Card>
      ))}
    </Stack>
  )
}
