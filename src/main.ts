import {
	App,
	Editor,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	Notice,
	setIcon,
} from 'obsidian';

import {
	PluginSettings,
	DEFAULT_SETTINGS,
} from './settings';

import { ExportModal } from './modal';
import { ANKI_CONNECT_DEFAULT_PORT } from './utils/anki';
import { isNumeric } from './utils/validations';
import { CustomModel } from './models/customModel';
import { StatusBarElement } from './utils/custom-types';

export default class AutoAnkiPlugin extends Plugin {
	settings: PluginSettings;
	statusBar: StatusBarElement;
	statusBarIcon: HTMLElement;

	async onload() {
		await this.loadSettings();
				
		this.addSettingTab(new AutoAnkiSettingTab(this.app, this));
        const defaults = this.settings.questionGenerationDefaults;
        const { textSelection: defaultsTextSelection, file: defaultsFile } = defaults;

		this.statusBar = this.addStatusBarItem();
		this.statusBar.className = 'status-bar-auto-anki';
		this.statusBarIcon = this.statusBar.createEl('span', { cls: 'status-bar-icon' });
		this.statusBar.createEl('div', { text: 'auto-anki' });
		this.statusBar.doReset = () => {
			setIcon(this.statusBarIcon, 'check-circle-2');
			this.statusBar.classList.remove('--running');
			this.statusBar.classList.remove('--error');
		};
		this.statusBar.doDisplayError = () => {
			setIcon(this.statusBarIcon, 'alert-circle');
			this.statusBar.classList.remove('--running');
			this.statusBar.classList.add('--error');
		};
		this.statusBar.doDisplayRunning = () => {
			setIcon(this.statusBarIcon, 'refresh-cw');
			this.statusBar.classList.remove('--error');
			this.statusBar.classList.add('--running');
		};
		this.statusBar.doReset();

		this.addCommand({
			id: 'export-current-file-to-anki',
			name: 'Export Current File to Anki',
			checkCallback: (checking: boolean) => {
				if (this.settings.openAiApiKey == null) {
					return false;
				}

				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view == null) {
					return false;
				}

				if (!checking) {
					if (view.data.length <= 0) {
						new Notice('There is nothing in the file!');
						return;
					}

					const apiKey = this.settings.openAiApiKey;
					const port = this.settings.ankiConnectPort || ANKI_CONNECT_DEFAULT_PORT;
					new ExportModal(
						this.app,
						this.statusBar,
						view.data,
						apiKey,
						port,
						this.settings.ankiDestinationDeck,
						this.settings.gptAdvancedOptions,
						defaultsFile.numQuestions,
						defaultsFile.numAlternatives,
					).open();
				}

				return true;
			},
		});

		this.addCommand({
			id: 'export-current-file-to-anki',
			name: '导出当前文件到Anki',
			checkCallback: (checking: boolean) => {
				if (this.settings.customApiKey == null) {
					return false;
				}

				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view == null) {
					return false;
				}

				if (!checking) {
					if (view.data.length <= 0) {
						new Notice('文件为空！');
						return;
					}

					const apiKey = this.settings.customApiKey;
					this.callCustomApi(view.data).then(response => {
						// 处理自定义API的响应
					});
				}

				return true;
			},
		});
	}
	
	onunload() {
	}
	
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async callCustomApi(data: any) {
		const response = await request({
			url: 'https://your-custom-api-endpoint.com',
			method: 'POST',
			body: JSON.stringify(data),
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.settings.customApiKey}`,
			},
		});
		return JSON.parse(response);
	}
}

class AutoAnkiSettingTab extends PluginSettingTab {
	plugin: AutoAnkiPlugin;
	maxFilesSetting: Setting;
	
	constructor(app: App, plugin: AutoAnkiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const { containerEl } = this;
		
		containerEl.empty();

		const ankiDescription = document.createElement('div');
		ankiDescription.innerHTML = '<p><a href="https://apps.ankiweb.net/">Anki</a> is an open-source flashcard program that is popular for spaced repetition. This plugin has only been tested on deskt[...]
		containerEl.appendChild(ankiDescription)
		
		new Setting(containerEl)
			.setName('Anki Port')
			.setDesc('The port number used to host Anki Connect')
			.addText(textComponent => textComponent
				.setPlaceholder('Anki Connect Default: 8765')
				.setValue(String(this.plugin.settings.ankiConnectPort))
				.onChange(async (value) => {
					this.plugin.settings.ankiConnectPort = Number(value);
					await this.plugin.saveSettings();
				})
			);
		
		const openAiDescription = new DocumentFragment();
		const openAiDescHtml = document.createElement('p');
		openAiDescHtml.innerHTML = 'The API Key associated with your OpenAI account, used for querying GPT. Go <a href="https://platform.openai.com/account/api-keys">here</a> to obtain one.';
		openAiDescription.appendChild(openAiDescHtml);

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc(openAiDescription)
			.addText(textComponent => textComponent
				.setPlaceholder(`key entered: ${this.plugin.settings.openAiApiKeyIdentifier}` ?? 'NO_KEY_ENTERED')
				.onChange(async (value) => {
					this.plugin.settings.openAiApiKey = value;
                    let identifier = 'xxxx';
                    if (value.length >= 7) {
                        identifier = `${value.slice(0,3)}...${value.slice(-4)}`
                    }
                    this.plugin.settings.openAiApiKeyIdentifier = identifier;
					await this.plugin.saveSettings();
				})
			);

        containerEl.createEl('h2', { text: 'Default Options for Exporting' });
		
		new Setting(containerEl)
			.setName('Anki Default Deck Name')
			.setDesc('The name of the deck in Anki you want to export flashcards to, by default')
			.addText(textComponent => textComponent
				.setPlaceholder('Default')
				.setValue(String(this.plugin.settings.ankiDestinationDeck))
				.onChange(async (value) => {
					this.plugin.settings.ankiDestinationDeck = value;
					await this.plugin.saveSettings();
				})
			);

        containerEl.createEl('p', { text: '--> For exporting full files' });
        
		new Setting(containerEl)
            .setName('Number of Questions')
            .setDesc('The number of questions to generate from the file.')
            .addText(textComponent => textComponent
                .setValue(String(this.plugin.settings.questionGenerationDefaults.file.numQuestions))
                .onChange(async (value) => {
					if (value == '') {
						this.plugin.settings.questionGenerationDefaults.file.numQuestions = 0;
						await this.plugin.saveSettings();
					}
					else if (!isNumeric(value)) {
						new Notice('The value you entered is not a number value');
					}
					else {
						this.plugin.settings.questionGenerationDefaults.file.numQuestions = Number(value);
						await this.plugin.saveSettings();
					}
                })
            );

		new Setting(containerEl)
			.setName('Number of Alternatives')
			.setDesc('The number of alternatives to generate for each question. Zero means no alteratives.')
			.addText(textComponent => textComponent
				.setValue(String(this.plugin.settings.questionGenerationDefaults.file.numAlternatives))
				.onChange(async (value) => {
					if (value == '') {
						this.plugin.settings.questionGenerationDefaults.file.numAlternatives = 0;
						await this.plugin.saveSettings();
					}
					else if (!isNumeric(value)) {
						new Notice('The value you entered is not a number value');
					}
					else {
						this.plugin.settings.questionGenerationDefaults.file.numAlternatives = Number(value);
						await this.plugin.saveSettings();
					}
				})
			);

        containerEl.createEl('p', { text: '--> For exporting selected text' });
        
		new Setting(containerEl)
            .setName('Number of Questions')
            .setDesc('The number of questions to generate from the selected text.')
            .addText(textComponent => textComponent
                .setValue(String(this.plugin.settings.questionGenerationDefaults.textSelection.numQuestions))
                .onChange(async (value) => {
					if (value == '') {
						this.plugin.settings.questionGenerationDefaults.textSelection.numQuestions = 0;
						await this.plugin.saveSettings();
					}
					else if (!isNumeric(value)) {
						new Notice('The value you entered is not a number value');
					}
					else {
						this.plugin.settings.questionGenerationDefaults.textSelection.numQuestions = Number(value);
						await this.plugin.saveSettings();
					}
                })
            );

		new Setting(containerEl)
			.setName('Number of Alternatives')
			.setDesc('The number of alternatives to generate for each question. Zero means no alteratives.')
			.addText(textComponent => textComponent
				.setValue(String(this.plugin.settings.questionGenerationDefaults.textSelection.numAlternatives))
				.onChange(async (value) => {
					if (value == '') {
						this.plugin.settings.questionGenerationDefaults.textSelection.numAlternatives = 0;
						await this.plugin.saveSettings();
					}
					else if (!isNumeric(value)) {
						new Notice('The value you entered is not a number value');
					}
					else {
						this.plugin.settings.questionGenerationDefaults.textSelection.numAlternatives = Number(value);
						await this.plugin.saveSettings();
					}
				})
			);

        containerEl.createEl('h2', { text: 'Advanced Options for OpenAI\'s GPT Models' });

        const tempValComponent = createEl('span', {
			text: String(this.plugin.settings.gptAdvancedOptions.temperature),
			cls: 'slider-val',
		});
        const tempComponent = new Setting(containerEl)
            .setName('Temperature')
            .setDesc('The sampling temperature used. Higher values increases randomness, while lower values makes the output more deterministic. (Default = 1)')
            .addSlider(sliderComponent => sliderComponent
                .setValue(this.plugin.settings.gptAdvancedOptions.temperature)
                .setLimits(0, 2, 0.1)
                .onChange(async (value) => {
                    this.plugin.settings.gptAdvancedOptions.temperature = value;
                    tempValComponent.textContent = String(value);
                    await this.plugin.saveSettings();
                })
            );
        tempComponent.settingEl.appendChild(tempValComponent);

        const topPValComponent = createEl('span', {
			text: String(this.plugin.settings.gptAdvancedOptions.top_p),
			cls: 'slider-val',
		});
        const topPComponent = new Setting(containerEl)
            .setName('Top P')
            .setDesc('Value for nucleus sampling. Lower values mean the output considers the tokens comprising higher probability mass. (Default = 1)')
            .addSlider(sliderComponent => sliderComponent
                .setValue(this.plugin.settings.gptAdvancedOptions.top_p)
                .setLimits(0, 1, 0.05)
                .onChange(async (value) => {
                    this.plugin.settings.gptAdvancedOptions.top_p = value;
                    topPValComponent.textContent = String(value);
                    await this.plugin.saveSettings();
                })
            );
        topPComponent.settingEl.appendChild(topPValComponent);

        const fPenaltyValComponent = createEl('span', {
			text: String(this.plugin.settings.gptAdvancedOptions.frequency_penalty),
			cls: 'slider-val',
		});
        const fPenaltyComponent = new Setting(containerEl)
            .setName('Frequency Penalty')
            .setDesc('Positive values penalize new tokens based on their existing frequency in the text so far. Higher values decrease chance of \'repetition\'. (Default = 0)')
            .addSlider(sliderComponent => sliderComponent
                .setValue(this.plugin.settings.gptAdvancedOptions.frequency_penalty)
                .setLimits(-2, 2, 0.1)
                .onChange(async (value) => {
                    this.plugin.settings.gptAdvancedOptions.frequency_penalty = value;
                    fPenaltyValComponent.textContent = String(value);
                    await this.plugin.saveSettings();
                })
            );
        fPenaltyComponent.settingEl.appendChild(fPenaltyValComponent);

        const pPenaltyValComponent = createEl('span', {
			text: String(this.plugin.settings.gptAdvancedOptions.presence_penalty),
			cls: 'slider-val',
		});
		const pPenaltyComponent = new Setting(containerEl)
            .setName('Presence Penalty')
            .setDesc('Positive values penalize new tokens based on whether they appear in the text so far. Higher values increase chance of \'creativity\'. (Default = 0)')
            .addSlider(sliderComponent => sliderComponent
                .setValue(this.plugin.settings.gptAdvancedOptions.presence_penalty)
                .setLimits(-2, 2, 0.1)
                .onChange(async (value) => {
                    this.plugin.settings.gptAdvancedOptions.presence_penalty = value;
                    pPenaltyValComponent.textContent = String(value);
                    await this.plugin.saveSettings();
                })
            );
        pPenaltyComponent.settingEl.appendChild(pPenaltyValComponent);

        const openAiTokenDescription = new DocumentFragment();
        const openAiTokenDescHtml = document.createElement('p');
        openAiTokenDescHtml.innerHTML = 'The maximum number of tokens consumed for each question. See <a href="https://platform.openai.com/tokenizer">tokens</a> to better understand how tokens ar[...]
        openAiTokenDescription.appendChild(openAiTokenDescHtml);

        new Setting(containerEl)
            .setName('Maximum Tokens per Question')
            .setDesc(openAiTokenDescription)
            .addText(textComponent => textComponent
                .setValue(String(this.plugin.settings.gptAdvancedOptions.max_tokens_per_question))
                .onChange(async (value) => {
					if (value == '') {
						this.plugin.settings.gptAdvancedOptions.max_tokens_per_question = DEFAULT_SETTINGS.gptAdvancedOptions.max_tokens_per_question;
						await this.plugin.saveSettings();
					}
					else if (!isNumeric(value)) {
						new Notice('The value you entered is not a number value');
					}
					else {
						this.plugin.settings.gptAdvancedOptions.max_tokens_per_question = Number(value);
						await this.plugin.saveSettings();
					}
                })
            );
	}
}
