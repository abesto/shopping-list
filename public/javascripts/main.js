/*global $, Backbone, Hogan*/
(function () {
    'use strict';
    var Item, ItemView, Items, ItemsView,
        Tab, TabPillView, NewTabPillView,
        TabContentView,
        Tabs, TabsPillView, TabsContentView;

    ItemView = Backbone.View.extend({
        tagName: 'tr',
        className: 'item',

        events: {
            'click': 'toggleDone',
            'click .delete': 'destroy'
        },

        initialize: function () {
            this.$td = $('<td>').appendTo(this.$el);
            this.$text = $('<span>').addClass('text').appendTo(this.$td);
            $('<a>')
                .appendTo(this.$td)
                .addClass('delete').addClass('btn')
                .addClass('hidden-phone')
                .text('Töröl');

            this.model.on('change', this.render, this);
        },

        render: function () {
            this.$text.text(this.model.get('text'));
            this.$el.toggleClass('done', this.model.get('done'));
            return this;
        },

        toggleDone: function () {
            this.model.set('done', !this.model.get('done'));
            this.model.save();
        },

        destroy: function (e) {
            e.stopPropagation();
            this.model.destroy();
        }
    });

    Item = Backbone.Model.extend({
        defaults: {
            done: false
        },

        initialize: function () {
            this.view = new ItemView({model: this});
        }
    });

    ItemsView = Backbone.View.extend({
        tagName: 'table',
        className: 'table',

        events: {
            'submit form': 'create'
        },

        initialize: function () {
            this.collection.on('add', this.add, this);
            this.collection.on('remove', this.remove, this);
            this.collection.on('reset', this.render, this);
            this.$el.append('<tbody>').append('<tfoot>');
            this.$tbody = this.$('tbody');
            this.$tfoot = this.$('tfoot').append(
                '<tr><td colspan="2"><form class="form-inline"><input type="text" name="text"/><input type="submit" value="Felvesz" class="btn"/></form></td></tr>'
            ).addClass('hidden-phone');
        },

        render: function () {
            var i;
            this.$tbody.children().remove();
            for (i = 0; i < this.collection.length; i += 1) {
                this.$tbody.append(this.collection.at(i).view.render().el);
            }
            return this;
        },

        add: function (model, collection, options) {
            this.$tbody.append(model.view.render().$el);
        },

        remove: function (model, collection, options) {
            this.$tbody.find(model.view.$el).remove();
        },

        create: function (e) {
            e.preventDefault();
            var text = this.$('input[name=text]').val().trim();
            if (text.length === 0) { return; }
            this.$('input[name=text]').val('');
            this.collection.create({
                tabId: this.collection.tab.get('id'),
                text: text
            });
        }
    });

    Items = Backbone.Collection.extend({
        url: '/item',
        model: Item,

        initialize: function () {
            this.view = new ItemsView({collection: this});
        }
    });

    TabPillView = Backbone.View.extend({
        tagName: 'li',
        className: 'tab',

        events: {
            'shown a': 'shown',
            'click .icon-remove': 'delete',
            'click .icon-edit': 'edit'
        },

        href: function () { return '#tab-' + this.model.get('id'); },
        text: function () { return this.model.get('text'); },

        initialize: function () {
            this.model.on('change', this.render, this);
            this.$a = $('<a>').attr('href', this.href());
            this.$text = $('<span>').appendTo(this.$a);
            this.$edit = $('<i>').addClass('icon-edit').addClass('hidden-phone').appendTo(this.$a);
            this.$del = $('<i>').addClass('icon-remove').addClass('hidden-phone').appendTo(this.$a);
            this.$el.append(this.$a);
        },

        render: function () {
            this.$text.text(this.text());
            this.$a.attr('data-toggle', 'pill');
            return this;
        },

        show: function () {
            this.$a.tab('show');
        },

        shown: function () {
            this.model.items.fetch({data: {'tab': this.model.get('id')}});
        },

        delete: function (e) {
            e.stopPropagation();
            if (confirm('Biztosan törölni akarod a "' + this.text() + '" nevű fület?')) {
                if (this.$el.hasClass('active') && this.model.collection.length > 1) {
                    var newActive = this.model.collection.at(0);
                    if (newActive === this.model) {
                        newActive = this.model.collection.at(1);
                    }
                    newActive.pillView.show();
                }
                this.model.destroy();
            }
        },

        edit: function (e) {
            e.stopPropagation();
            this.model.set('text', prompt('A "' + this.text() + '" fül új neve:'));
            this.model.save();
        }
    });

    NewTabPillView = Backbone.View.extend({
        tagName: 'li',
        className: 'hidden-phone',
        href: function () { return '#new-tab-modal'; },
        text: function () { return '+'; },
        initialize: function () {
            this.$a = $('<a>')
                .attr('href', this.href())
                .attr('data-toggle', 'modal')
                .text('+')
                .appendTo(this.$el);

            var $newTabModal =  $('#new-tab-modal'),
                $newTabForm = $newTabModal.find('form'),
                $newTabName = $newTabForm.find('input[name=new-tab-name]'),
                that = this;
            $newTabModal.on('shown', function () {
                $newTabName.focus();
            });
            $newTabModal.on('hidden', function () {
                that.$a.blur();
            });
            $newTabForm.submit(function (e) {
                e.preventDefault();
                that.collection.create({text: $newTabName.val()});
                $newTabName.val('');
                $newTabModal.modal('hide');
            });
        }
    });

    TabContentView = Backbone.View.extend({
        tabName: 'div',
        className: 'tab-pane',

        id: function () { return 'tab-' + this.model.get('id'); },

        initialize: function () {
            var that = this;
            this.model.on('change:id', function () {
                that.$el.attr('id', that.id());
            });
        },

        render: function () {
            this.$el.children().remove();
            this.$el.append(
                this.model.items.view.render().$el
            );
            return this;
        }
    });

    Tab = Backbone.Model.extend({
        initialize: function () {
            this.items = new Items();
            this.items.tab = this;
            this.pillView = new TabPillView({model: this});
            this.contentView = new TabContentView({model: this});
        }
    });

    TabsPillView = Backbone.View.extend({
        tagName: 'ul',
        className: 'nav nav-tabs',

        initialize: function () {
            this.newTabView = new NewTabPillView({collection: this.collection}).render();

            this.collection.on('add', this.add, this);
            this.collection.on('remove', this.remove, this);
            this.collection.on('reset', this.render, this);
        },

        add: function (model, collection, options) {
            this.newTabView.$el.before(
                model.pillView.render().$el
            );
        },

        remove: function (model, collection, options) {
            this.$el.find(model.pillView.$el).remove();
        },

        render: function () {
            var i;
            this.$el.children().remove();
            for (i = 0; i < this.collection.length; i += 1) {
                this.$el.append(this.collection.at(i).pillView.render().$el);
            }
            this.$el.append(this.newTabView.render().$el);
            return this;
        }
    });

    TabsContentView = Backbone.View.extend({
        tagName: 'div',
        className: 'tab-content',

        initialize: function () {
            this.collection.on('add', this.add, this);
            this.collection.on('remove', this.remove, this);
            this.collection.on('reset', this.render, this);
            this.render();
        },

        render: function () {
            var i;
            this.$el.children().remove();
            for (i = 0; i < this.collection.length; i += 1) {
                this.$el.append(this.collection.at(i).contentView.render().$el);
            }
            if (this.collection.length > 0) {
                this.collection.at(0).pillView.show();
            }
            return this;
        },

        add: function (model, collection, options) {
            this.$el.append(model.contentView.render().$el);
        },

        remove: function (model, collection, options) {
            this.$el.find(model.contentView.$el).remove();
        }
    });

    Tabs = Backbone.Collection.extend({
        url: '/tab',
        model: Tab,
        initialize: function () {
            this.pillView = new TabsPillView({collection: this});
            this.contentView = new TabsContentView({collection: this});
        }
    });

    $(function () {
        var tabs = new Tabs();
        $('#content')
            .append(tabs.pillView.$el)
            .append(tabs.contentView.$el);
        tabs.fetch();
        // Leak into global namespace for debugging
        window.tabs = tabs;
    });


}());

