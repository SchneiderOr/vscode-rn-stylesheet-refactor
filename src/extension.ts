/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { subscribeToDocumentChanges, EMOJI_MENTION } from './diagnostics';

const COMMAND = 'code-actions-sample.command';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider('javascript', new Stylesheetizer(), {
			providedCodeActionKinds: Stylesheetizer.providedCodeActionKinds,
		})
	);

	const innerStylesDiagnostics = vscode.languages.createDiagnosticCollection('innerStyle');
	context.subscriptions.push(innerStylesDiagnostics);

	// subscribeToDocumentChanges(context, innerStylesDiagnostics);

	// context.subscriptions.push(
	// 	vscode.languages.registerCodeActionsProvider(
	// 		['javascript', 'typescript'],
	// 		new Emojinfo(),
	// 		{
	// 			providedCodeActionKinds: Emojinfo.providedCodeActionKinds,
	// 		}
	// 	)
	// );

	// context.subscriptions.push(
	// 	vscode.commands.registerCommand(COMMAND, () =>
	// 		vscode.env.openExternal(
	// 			vscode.Uri.parse('https://unicode.org/emoji/charts-12.0/full-emoji-list.html')
	// 		)
	// 	)
	// );
}

/**
 * Provides code actions for converting :) to a smiley emoji.
 */
export class Stylesheetizer implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

	public provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range
	): vscode.CodeAction[] | undefined {
		if (!this.isInnerStyleDecleration(document, range)) {
			return;
		}

		const replaceWithNamedStyle = this.createFix(document, range);
		return [replaceWithNamedStyle];
	}

	private isInnerStyleDecleration(document: vscode.TextDocument, range: vscode.Range) {
		const start = range.start;
		const end = range.end;
		const line = document.lineAt(start.line);
		const endLine = document.lineAt(end.line);
		return line.text[start.character] === '{' && endLine.text[end.character] === '}';
	}

	private getStyledObjectRefrences(
		value = '',
		document: vscode.TextDocument,
		range: vscode.Range
	): Promise<any> {
		// Return a promise, since this might take a while for large documents
		return new Promise<any>((resolve, reject) => {
			const testsToReturn = new Array<any>();
			const lineCount = document.lineCount;

			for (let lineNumber = 0; lineNumber < lineCount; lineNumber++) {
				const lineText = document.lineAt(lineNumber);

				const test = lineText.text.match(/(\ .*)\= StyleSheet/);
				if (test) {
					testsToReturn.push({
						lineNumber,
						lineText: lineText,
						match: test[1].trimStart().trimEnd(),
					});
				}
			}
			if (testsToReturn.length > 0) {
				resolve({
					className: value,
					styleObject: document.getText(range),
					styleSheetObject: {
						lineNumber: testsToReturn[0].lineNumber,
						varName: testsToReturn[0].match,
					},
				});
			} else {
				reject("Couldn't find any style objects");
			}
		});
	}

	private createFix(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		// if (editor) {
		// 	const document = editor.document;
		// 	const selection = editor.selection;

		// 	// Get the word within the selection
		// 	const word = document.getText(selection);
		// 	console.log(word);

		// 	const reversed = word.split('').reverse().join('');
		// 	editor.edit((editBuilder) => {
		// 		editBuilder.replace(selection, reversed);
		// 	});
		// }

		const fix = new vscode.CodeAction(
			`Convert to style in your StyleSheet`,
			vscode.CodeActionKind.Refactor
		);

		fix.edit = new vscode.WorkspaceEdit();
		this.showAddNamedClassDialog(document, range);
		return fix;
	}

	private showAddNamedClassDialog(document: vscode.TextDocument, range: vscode.Range) {
		vscode.window
			.showInputBox({
				prompt: 'Name of the extracted style',
				validateInput: (str) =>
					/[^A-Za-z0-9]+/.test(str) ? 'Not a valid class name' : null,
			})
			.then((value) => this.getStyledObjectRefrences(value, document, range))
			.then(({ styleSheetObject, className, styleObject }) => {
				if (!!styleSheetObject && !!className && !!styleObject) {
					this.applyStyleChangesToDocumnet(range, className, styleSheetObject);
				}
			});
	}

	private applyStyleChangesToDocumnet(
		range: vscode.Range,
		className: string,
		styleSheetObject: { varName: string; lineNumber: number }
	): void {
		const { activeTextEditor } = vscode.window;

		if (activeTextEditor) {
			const { document } = activeTextEditor;
			if (document) {
				/*
				build your textEdits similarly to the above with insert, delete, replace
				but not within an editBuilder arrow function
				textEdits.push(vscode.TextEdit.replace(...));
				textEdits.push(vscode.TextEdit.insert(...));
				*/
				const textEdits: vscode.TextEdit[] = [];

				const selection = activeTextEditor.selection;
				const styleObjectText = document.getText(selection);
				const styleSheetObjectRange = new vscode.Position(
					styleSheetObject.lineNumber + 1,
					styleSheetObject.lineNumber + 1
				);

				textEdits.push(
					vscode.TextEdit.replace(
						new vscode.Range(
							new vscode.Position(range.start.line, range.start.character),
							range.end
						),
						`${styleSheetObject?.varName ?? 'styles'}.${className}`
					),
					vscode.TextEdit.insert(styleSheetObjectRange, `${className}: ${styleObjectText},`)
				);

				const workEdits = new vscode.WorkspaceEdit();
				workEdits.set(document.uri, textEdits); // give the edits
				vscode.workspace.applyEdit(workEdits); // apply the edits
			}
		}
	}

	private createCommand(): vscode.CodeAction {
		const action = new vscode.CodeAction('Learn more...', vscode.CodeActionKind.Empty);
		action.command = {
			command: COMMAND,
			title: 'Learn more about emojis',
			tooltip: 'This will open the unicode emoji page.',
		};
		return action;
	}
}

/**
 * Provides code actions corresponding to diagnostic problems.
 */
// export class Emojinfo implements vscode.CodeActionProvider {
// 	public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

// 	provideCodeActions(
// 		document: vscode.TextDocument,
// 		range: vscode.Range | vscode.Selection,
// 		context: vscode.CodeActionContext,
// 		token: vscode.CancellationToken
// 	): vscode.CodeAction[] {
// 		// for each diagnostic entry that has the matching `code`, create a code action command
// 		return context.diagnostics
// 			.filter((diagnostic) => diagnostic.code === EMOJI_MENTION)
// 			.map((diagnostic) => this.createCommandCodeAction(diagnostic));
// 	}

// 	private createCommandCodeAction(diagnostic: vscode.Diagnostic): vscode.CodeAction {
// 		const action = new vscode.CodeAction('Learn more...', vscode.CodeActionKind.QuickFix);
// 		action.command = {
// 			command: COMMAND,
// 			title: 'Learn more about emojis',
// 			tooltip: 'This will open the unicode emoji page.',
// 		};
// 		action.diagnostics = [diagnostic];
// 		action.isPreferred = true;
// 		return action;
// 	}
// }
