import type { ReactNode } from 'react'
import React, { Component } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: unknown
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('MsaViewPanel error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <ErrorMessage error={this.state.error} />
        </div>
      )
    }

    return this.props.children
  }
}
