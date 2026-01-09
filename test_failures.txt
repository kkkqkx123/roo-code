
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ············xxx·····xx·x········x·x········································x···································································xx·········x·····························································································································································································································································-··············································································································································································································--·---·····································································································································································································································
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯ Failed Tests 12 ⎯⎯⎯⎯⎯⎯⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/__tests__/App.spec.tsx > App > switches to marketplace view when receiving marketplaceButtonClicked action
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element by: [data-testid="marketplace-view"]
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/__tests__/App.spec.tsx > App > returns to chat view when clicking done in marketplace view
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element by: [data-testid="marketplace-view"]
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/context/__tests__/ExtensionStateContext.roo-auth-gate.spec.tsx > ExtensionStateContext Roo auth gate > posts requestRooModels when auth flips and provider === 'roo'
  @roo-code/vscode-webview:test: AssertionError: expected "spy" to be called with arguments: [ { type: 'requestRooModels' } ]
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Number of calls: 0
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/ChatView.spec.tsx > ChatView - DismissibleUpsell Display Tests > shows DismissibleUpsell when user is not authenticated and has run 6 or more tasks
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element by: [data-testid="dismissible-upsell"]
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Authenticated User Share Flow > shows organization and public share options when authenticated and sharing enabled
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element with the text: Share with Organization. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Authenticated User Share Flow > sends shareCurrentTask message when organization option is selected
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element with the text: Share with Organization. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Authenticated User Share Flow > sends shareCurrentTask message when public option is selected
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element with the text: Share Publicly. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Authenticated User Share Flow > does not show organization option when user is not in an organization
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element with the text: Share Publicly. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Unauthenticated User Login Flow > shows connect to cloud option when not authenticated
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element with the text: Connect to Roo Code Cloud. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Unauthenticated User Login Flow > sends rooCloudSignIn message when connect to cloud is selected
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element with the text: Connect. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Mixed Authentication States > shows disabled share button when authenticated but sharing not enabled
  @roo-code/vscode-webview:test: Error: expect(element).toBeDisabled()
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Received element is not disabled:
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/12]⎯
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  FAIL  src/components/chat/__tests__/TaskActions.spec.tsx > TaskActions > Mixed Authentication States > automatically opens popover when user authenticates from share button
  @roo-code/vscode-webview:test: TestingLibraryElementError: Unable to find an element with the text: Connect. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: Ignored nodes: comments, script, style
  @roo-code/vscode-webview:test: ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[12/12]⎯
  @roo-code/vscode-webview:test: 
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  Test Files  4 failed | 79 passed (83)
> @roo-code/vscode-webview:test:       Tests  12 failed | 832 passed | 6 skipped (850)
  @roo-code/vscode-webview:test:    Start at  15:45:42
  @roo-code/vscode-webview:test:    Duration  46.50s (transform 27.24s, setup 35.21s, collect 215.02s, tests 42.52s, environment 273.62s, prepare 44.44s)
  @roo-code/vscode-webview:test: 
> @roo-code/vscode-webview:test:  ELIFECYCLE  Test failed. See above for more details.
  roo-code:test: cache miss, executing 34972227a0bb4b5b
  roo-code:test: 
  roo-code:test: > roo-code@0.0.0 pretest D:\项目\agent\Roo-Code\src
  roo-code:test: {"t":3,"l":"info","m":"Updating project mode in .roomodes","d":{"slug":"mode2","workspace":"D:\\mock\\workspace"}}
  roo-code:test: {"t":5,"l":"info","m":"Removed existing project rules folder for mode mode2"}
  roo-code:test: {"t":1,"l":"info","m":"Detected old export format, stripping rules-mode2\\ from path"}
> roo-code:test: ············{"t":45,"l":"error","m":"Failed to import mode with rules","d":{"error":"Permission denied"}}
  roo-code:test: {"t":5,"l":"info","m":"Updating project mode in .roomodes","d":{"slug":"test-mode","workspace":"D:\\mock\\workspace"}}
  roo-code:test: ·················{"t":103,"l":"info","m":"Removed existing project rules folder for mode test-mode"}
  roo-code:test: {"t":1,"l":"error","m":"Invalid file path detected: ../../../etc/passwd"}
  roo-code:test: {"t":6,"l":"info","m":"Updating project mode in .roomodes","d":{"slug":"test-mode","workspace":"D:\\mock\\workspace"}}
  roo-code:test: {"t":3,"l":"info","m":"Removed existing project rules folder for mode test-mode"}
  roo-code:test: {"t":0,"l":"info","m":"Detected old export format, stripping rules-test-mode\\ from path"}
> roo-code:test: {"t":4,"l":"error","m":"Failed to check rules directory for mode","d":{"slug":"test-mode","error":"The \"path\" argument must be of type string. Received null"}}
  roo-code:test: ··································································-·-----·········································································································································································································································{"t":62,"l":"info","m":"Updating project mode in .roomodes","d":{"slug":"new-slug-name","workspace":"D:\\mock\\workspace"}}
  roo-code:test: {"t":6,"l":"info","m":"Removed existing project rules folder for mode new-slug-name"}
  roo-code:test: {"t":11,"l":"info","m":"Updating project mode in .roomodes","d":{"slug":"new-slug-name","workspace":"D:\\mock\\workspace"}}
   Tasks:    3 successful, 5 total
  Cached:    3 cached, 5 total
    Time:    50.889s 
> Failed:    @roo-code/vscode-webview#test
  
>  ERROR  run failed: command  exited (1)

