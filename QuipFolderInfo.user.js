// ==UserScript==
// @name         QuipFolderInfo
// @namespace    http://quip-amazon.com/
// @version      2024-05-25
// @description  Used to generate a directory structure into a document, facilitating full-text search
// @author       barrytan@
// @match        *://quip-amazon.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=quip-amazon.com
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

/**
 * 尝试获取对象，如果对象不存在则等待一段时间后重试
 * @param {Function} getObjectFunc 获取对象的函数
 * @param {String} selector 需要获取元素的selector
 * @param {Number} maxRetries 最大重试次数
 * @param {Number} retryDelay 重试延迟时间(毫秒)
 * @returns {Promise} 返回一个 Promise 对象,在成功获取对象时 resolve,或者达到最大重试次数时 reject
 */
function getObjectWithRetry(getObjectFunc, selector, maxRetries = 20, retryDelay = 500) {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const tryGetObject = () => {
      const obj = getObjectFunc(selector);
      if (obj) {
        resolve(obj);
      } else {
        retries++;
        if (retries >= maxRetries) {
          reject(new Error('Maximum retries reached'));
        } else {
          setTimeout(tryGetObject, retryDelay);
        }
      }
    };
    tryGetObject();
  });
}

/**
 * 尝试获取对象
 * @param {String} selector 需要获取元素的selector
 * @returns {jQuery Object} 返回 jQuery 对象，如果对象尚不存在，返回 null
 */
const getObjectAsync = (selector) => {
    var container = $(selector);
    console.log(container);
    if (container.length) {
        return container;
    }
    return null;
};

/**
 * 不同层级对象的 Markdown 前缀
 * @param {Number} level 指定层级，0为最顶层
 * @returns {String} 返回对应层级前缀
 */
function levelText(level) {
    switch(level) {
            case 0: return "\n## ";
            case 1: return "\n* ";
            case 2: return "\n\t* ";
            case 3: return "\n\t\t* ";
            case 4: return "\n\t\t\t* ";
            case 5: return "\n\t\t\t\t* ";
    }
    return "\n";
}

/**
 * 复制文字到剪贴板，注意剪贴板复制权限，需要人为触发
 * @param {String} text 需要复制文字
 * @returns 无
 */
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// 用于标识是否有未完成加载的项目
var global_loading_finish = true;

/**
 * 列出所有子项目，递归枚举
 * @param {Object} ele 根元素对象
 * @param {Number} level 元素所在层级
 * @returns {String} 项目和子项目的所有内容
 */
function listSubItem(ele, level) {
    var startTxt = [];
    var levelTxt = levelText(level);
    ele.children('.folder-list-row').each(function(){
        var item = $(this);
        var groupname = '';
        item.children().each(function(){
            var subitem = $(this);
            var role = subitem.attr('role');
            if (role == 'group') {
                // 递归子项目
                startTxt.push(groupname + listSubItem(subitem, level+1));
                groupname = '';
            } else if (role == 'treeitem') {
                // 本项目
                var name = subitem.attr('aria-label');
                var expand = subitem.attr('aria-expanded');
                var url = subitem.attr('href');
                if (groupname != '') {
                    startTxt.push(groupname);
                    groupname = '';
                }
                if (expand == "false" || (name == '加载项目' && url == undefined)) {
                    if (global_loading_finish) {
                        alert('有项目尚没有加载完成，请点击这些项目来触发加载。');
                        global_loading_finish = false;
                    }
                }
                if (name != '0.全局索引') {
                    groupname = '[' + name.replace('[','【').replace(']','】') + '](https://quip-amazon.com' + url + ')';
                }
            } else if (role != undefined) {
                console.log('unknown role:' + role);
            }
        });
        if (groupname != '') {
            startTxt.push(groupname);
        }
    });
    // 对内容进行排序
    startTxt.sort((a, b) => a[1].localeCompare(b[1]));
    return levelTxt + startTxt.join(levelTxt);
}

$(document).ready(function() {
    // 如果存在separator，则说明目前打开文档有目录层级
    getObjectWithRetry(getObjectAsync,'.nav-path-separator').then((obj) => {
        getObjectWithRetry(getObjectAsync, '.nav-path').then((btn) => {
            // 在导航条后方插入按钮
            const makeindex = document.createElement('button');
            makeindex.innerHTML = '生成索引';
            makeindex.style.cssText = "margin-left: 10px;";
            makeindex.addEventListener('click', () => {
                global_loading_finish = true;
                var rootitem = $('.folder-list-body>.folder-list-background>.folder-list-rows');
                var txt = listSubItem(rootitem, 0);
                // 没有内容生成
                if (txt == levelText(0)) {
                    alert('需要先在菜单“查看”中把模式设置为“常规列表”或“小列表”');
                    return;
                }
                console.log(txt);
                if (global_loading_finish) {
                    copyToClipboard(txt);
                    alert('成功生成全局索引内容，已复制到剪贴板，请打开“0.全局索引”文件，进行粘贴即可。');
                }
            });
            btn[0].append(makeindex);
        });
    });
});
