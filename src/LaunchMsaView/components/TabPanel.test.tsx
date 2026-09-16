// @vitest-environment jsdom
import React from 'react'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import TabPanel from './TabPanel'

afterEach(() => {
  cleanup()
})

function Panels({ value }: { value: string }) {
  return (
    <>
      <TabPanel value={value} index="a">
        <Probe name="a" />
      </TabPanel>
      <TabPanel value={value} index="b">
        <Probe name="b" />
      </TabPanel>
    </>
  )
}

const mounted = vi.fn()

function Probe({ name }: { name: string }) {
  React.useEffect(() => {
    mounted(name)
  }, [name])
  return <input defaultValue={name} />
}

test('a visited panel keeps its state while another tab is shown', () => {
  const { rerender } = render(<Panels value="a" />)
  const typed = screen.getByDisplayValue('a')
  ;(typed as HTMLInputElement).value = 'edited'

  rerender(<Panels value="b" />)
  rerender(<Panels value="a" />)

  expect(screen.getByDisplayValue('edited')).toBeTruthy()
  expect(mounted.mock.calls.filter(([n]) => n === 'a')).toHaveLength(1)
})

test('an unvisited panel does not mount, so it fetches nothing', () => {
  mounted.mockClear()
  render(<Panels value="a" />)
  expect(mounted.mock.calls.map(([n]) => n)).toEqual(['a'])
})
