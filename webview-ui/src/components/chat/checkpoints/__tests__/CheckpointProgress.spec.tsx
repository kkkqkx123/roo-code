import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act, fireEvent } from "@/utils/test-utils"
import { CheckpointProgress } from "../CheckpointProgress"

// Mock timers for progress animation
vi.useFakeTimers()

// Mock translation context
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => {
      const translations: Record<string, string> = {
        "chat:checkpoint.progress.title": "Checkpoint Progress",
        "chat:checkpoint.progress.initializing": "Initializing checkpoint...",
        "chat:checkpoint.progress.staging": "Staging files...",
        "chat:checkpoint.progress.committing": "Creating checkpoint...",
        "chat:checkpoint.progress.completed": "Checkpoint created successfully",
        "chat:checkpoint.progress.error": "Checkpoint creation failed",
        "chat:checkpoint.progress.processing": "Processing...",
        "chat:checkpoint.progress.done": "Done",
        "chat:checkpoint.progress.failed": "Failed",
        "chat:checkpoint.progress.inProgress": "In progress",
      }
      return translations[key] || defaultValue || key
    },
  }),
}))

describe("CheckpointProgress", () => {
  beforeEach(() => {
    vi.clearAllTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not render when not visible", () => {
    render(
      <CheckpointProgress 
        isVisible={false}
        progress={0}
        status="initializing"
      />
    )
    
    expect(screen.queryByText("Checkpoint Progress")).not.toBeInTheDocument()
  })

  it("renders with correct initial state", () => {
    render(
      <CheckpointProgress 
        isVisible={true}
        progress={0}
        status="initializing"
      />
    )
    
    expect(screen.getByText("Checkpoint Progress")).toBeInTheDocument()
    expect(screen.getByText("Initializing checkpoint...")).toBeInTheDocument()
    expect(screen.getByText("0%")).toBeInTheDocument()
    expect(screen.getByText("In progress")).toBeInTheDocument()
  })

  it("shows correct status messages", () => {
    const testCases = [
      { status: 'initializing', message: 'Initializing checkpoint...' },
      { status: 'staging', message: 'Staging files...' },
      { status: 'committing', message: 'Creating checkpoint...' },
      { status: 'completed', message: 'Checkpoint created successfully' },
      { status: 'error', message: 'Checkpoint creation failed' }
    ]

    testCases.forEach(({ status, message }) => {
      const { unmount } = render(
        <CheckpointProgress 
          isVisible={true}
          progress={50}
          status={status as any}
        />
      )
      
      expect(screen.getByText(message)).toBeInTheDocument()
      unmount()
    })
  })

  it("shows custom message when provided", () => {
    render(
      <CheckpointProgress 
        isVisible={true}
        progress={75}
        status="staging"
        message="Custom progress message"
      />
    )
    
    expect(screen.getByText("Custom progress message")).toBeInTheDocument()
    expect(screen.queryByText("Staging files...")).not.toBeInTheDocument()
  })

  it("animates progress smoothly", () => {
    vi.useFakeTimers()
    
    render(
      <CheckpointProgress 
        isVisible={true}
        progress={50}
        status="committing"
      />
    )
    
    // Initially should show 0%
    expect(screen.getByText("0%")).toBeInTheDocument()
    
    // Advance timers to simulate animation
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    
    // Should show some progress
    const progressText = screen.getByText(/%/)
    expect(progressText.textContent).not.toBe("0%")
    
    vi.useRealTimers()
  })

  it("shows correct icons for each status", () => {
    const statusIcons = {
      'initializing': 'codicon-loading',
      'staging': 'codicon-loading',
      'committing': 'codicon-loading',
      'completed': 'codicon-check',
      'error': 'codicon-error'
    }

    Object.entries(statusIcons).forEach(([status, iconClass]) => {
      const { unmount } = render(
        <CheckpointProgress 
          isVisible={true}
          progress={100}
          status={status as any}
        />
      )
      
      const icon = screen.getByText("Checkpoint Progress").previousSibling
      expect(icon).toHaveClass(iconClass)
      unmount()
    })
  })

  it("shows correct progress bar colors", () => {
    const colorTestCases = [
      { status: 'completed', expectedClass: 'bg-vscode-inputValidation-infoBackground' },
      { status: 'error', expectedClass: 'bg-vscode-inputValidation-errorBackground' },
      { status: 'initializing', expectedClass: 'bg-vscode-progressBar-foreground' }
    ]

    colorTestCases.forEach(({ status, expectedClass }) => {
      const { unmount } = render(
        <CheckpointProgress 
          isVisible={true}
          progress={100}
          status={status as any}
        />
      )
      
      // Find the progress bar container
      const progressBarContainer = screen.getByText(/%/).closest('.flex.justify-between')?.previousElementSibling
      const progressBar = progressBarContainer?.querySelector('.h-full.rounded-full')
      expect(progressBar).toHaveClass(expectedClass)
      unmount()
    })
  })

  it("handles close button callback", () => {
    const mockOnClose = vi.fn()
    
    render(
      <CheckpointProgress 
        isVisible={true}
        progress={100}
        status="completed"
        onClose={mockOnClose}
      />
    )
    
    const closeButton = screen.getByRole("button")
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it("does not show close button when onClose not provided", () => {
    render(
      <CheckpointProgress 
        isVisible={true}
        progress={100}
        status="completed"
      />
    )
    
    // Close button should not exist
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("handles progress boundaries correctly", () => {
    render(
      <CheckpointProgress 
        isVisible={true}
        progress={150} // Above 100%
        status="staging"
      />
    )
    
    // The component should render without errors
    expect(screen.getByText("Checkpoint Progress")).toBeInTheDocument()
    expect(screen.getByText("Staging files...")).toBeInTheDocument()
  })

  it("handles negative progress", () => {
    render(
      <CheckpointProgress 
        isVisible={true}
        progress={-10} // Negative value
        status="staging"
      />
    )
    
    // Should clamp to 0%
    expect(screen.getByText("0%")).toBeInTheDocument()
  })

  it("animates in and out smoothly", () => {
    vi.useFakeTimers()
    
    const { rerender } = render(
      <CheckpointProgress 
        isVisible={false}
        progress={0}
        status="initializing"
      />
    )
    
    // Should not be visible initially
    expect(screen.queryByText("Checkpoint Progress")).not.toBeInTheDocument()
    
    // Make visible
    rerender(
      <CheckpointProgress 
        isVisible={true}
        progress={0}
        status="initializing"
      />
    )
    
    // Should be visible
    expect(screen.getByText("Checkpoint Progress")).toBeInTheDocument()
    
    // Make invisible
    rerender(
      <CheckpointProgress 
        isVisible={false}
        progress={100}
        status="completed"
      />
    )
    
    // Should still be visible during fade-out animation
    expect(screen.getByText("Checkpoint Progress")).toBeInTheDocument()
    
    // Advance timers to complete fade-out
    act(() => {
      vi.advanceTimersByTime(600)
    })
    
    // Should be hidden after animation
    expect(screen.queryByText("Checkpoint Progress")).not.toBeInTheDocument()
    
    vi.useRealTimers()
  })
})